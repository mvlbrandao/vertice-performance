/**
 * Filtros e paginação da tela de auditoria. Pura: tudo que chega pela URL é
 * validado aqui antes de virar parte de uma consulta.
 */
export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters {
  /**
   * "club" filtra por prefixo (toda ação de clube); "club.set_status" filtra
   * exatamente aquela ação. null = todas.
   */
  action: string | null;
  clubId: string | null;
  /** Cursor: só linhas estritamente anteriores a este instante (occurred_at). */
  before: string | null;
}

type Raw = string | string[] | undefined;

const ACTION_FILTER = /^[a-z_]+(\.[a-z_]+)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 com fuso, como o PostgREST devolve (microssegundos e +00:00 incluídos).
const CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/;

function first(value: Raw): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseAuditFilters(raw: { acao?: Raw; clube?: Raw; antes?: Raw }): AuditFilters {
  const action = first(raw.acao).trim();
  const clubId = first(raw.clube).trim();
  const before = first(raw.antes).trim();

  return {
    action: ACTION_FILTER.test(action) ? action : null,
    clubId: UUID.test(clubId) ? clubId.toLowerCase() : null,
    // O texto original é que vai à consulta (preserva os microssegundos); o
    // Date.parse só confirma que é uma data de verdade.
    before: CURSOR.test(before) && !Number.isNaN(Date.parse(before)) ? before : null,
  };
}

/** Ação exata ("club.set_status") ou prefixo de entidade ("club")? */
export function isExactAction(action: string): boolean {
  return action.includes(".");
}

/**
 * Escapa os curingas do LIKE (% e _) — "_" é caractere legítimo nos nomes de
 * ação e, sem escape, "club_x" casaria com "clubAx" e similares.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Endereço da tela com os filtros; o que for null/vazio não vai para a URL. */
export function auditHref(filters: Partial<AuditFilters>): string {
  const params = new URLSearchParams();
  if (filters.action) params.set("acao", filters.action);
  if (filters.clubId) params.set("clube", filters.clubId);
  if (filters.before) params.set("antes", filters.before);
  const qs = params.toString();
  return qs ? `/admin/auditoria?${qs}` : "/admin/auditoria";
}
