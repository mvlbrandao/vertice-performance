import { CLUB_TIME_ZONE } from "@/lib/utils/date";
import { CYCLE_LABEL, STATUS_LABEL, contractCode } from "@/lib/platform/contractRules";
import { formatBytes } from "@/lib/platform/contractDocumentPath";
import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";

/**
 * Como os contratos entram na trilha de auditoria (gravação) e como
 * aparecem na tela do contrato (leitura). Puro, sem "server-only".
 *
 * A trilha é imutável e dura para sempre, então o que entra nela é pensado:
 * só o que mudou, notas internas truncadas e nenhum nome de pessoa (nem
 * CPF/CNPJ, que nem existe no contrato). Quem assinou é dado pessoal; guardar
 * o nome numa tabela que ninguém consegue editar nem apagar impediria
 * atender um pedido de exclusão (LGPD).
 */

/** Até onde as notas internas vão na trilha: o suficiente para reconhecer a mudança. */
export const AUDIT_NOTES_MAX = 120;

const OMITTED = "(omitido)";

/** Campos cujo valor nunca vai para a trilha, só o fato de existirem. */
const PERSONAL_FIELDS = new Set(["signer_name"]);

export function truncateForAudit(value: string, max: number = AUDIT_NOTES_MAX): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Valor de um campo como ele deve ser gravado na trilha. */
export function sanitizeAuditValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (PERSONAL_FIELDS.has(field)) return OMITTED;
  if (field === "notes" && typeof value === "string") return truncateForAudit(value);
  return value;
}

/**
 * Diferença entre dois retratos do contrato, no formato `{ campo: { from, to } }`
 * de diffFields, com os valores já saneados. A comparação é feita nos valores
 * COMPLETOS e só depois se trunca: comparar texto já truncado esconderia uma
 * mudança que acontece depois do corte.
 */
export function contractChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    // Nome trocado por outro nome: os dois viram "(omitido)" e a linha pareceria
    // "sem mudança"; o rótulo da tela já diz o campo, então basta registrar que mudou.
    changes[key] = { from: sanitizeAuditValue(key, from), to: sanitizeAuditValue(key, to) };
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Apresentação (leitura): transforma o `details` gravado em algo legível para
// o AuditTable, sem mexer no que está gravado. Fica aqui, e não nos rótulos
// gerais da auditoria, porque as chaves são colunas do contrato.
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  plan_name: "Plano",
  price_cents: "Valor por ciclo",
  max_athletes: "Cota de atletas",
  billing_cycle: "Ciclo de cobrança",
  starts_on: "Início",
  ends_on: "Fim",
  auto_renew: "Renova automaticamente",
  signed_on: "Assinado em",
  signer_name: "Quem assinou",
  signer_role: "Cargo de quem assinou",
  terms_version: "Versão dos termos",
  notes: "Notas internas",
  status: "Situação",
  document_path: "Documento",
  closed_reason: "Motivo do fechamento",
};

const FACT_LABEL: Record<string, string> = {
  number: "Contrato",
  reason: "Motivo",
  replacedBy: "Substituído pelo",
  replaces: "Substitui o",
  renewedFrom: "Renovação do",
  sizeBytes: "Tamanho do PDF",
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatCivilBR(value: string): string {
  const match = CIVIL_DATE.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** closed_at e afins são instantes; só a data civil de Brasília interessa. */
function formatInstantBR(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function presentFieldValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    if (field === "max_athletes") return "padrão da plataforma";
    if (field === "ends_on") return "indeterminado";
    return null;
  }
  if (field === "price_cents" && typeof value === "number") return BRL.format(value / 100);
  if (field === "status" && typeof value === "string") return STATUS_LABEL[value as ContractStatus] ?? value;
  if (field === "billing_cycle" && typeof value === "string") {
    return CYCLE_LABEL[value as ContractBillingCycle] ?? value;
  }
  if (field === "document_path") return "PDF anexado";
  if ((field === "starts_on" || field === "ends_on" || field === "signed_on") && typeof value === "string") {
    return formatCivilBR(value);
  }
  if (field === "closed_at" && typeof value === "string") return formatInstantBR(value);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `details` de uma ação contract.* em português: rótulos dos campos do
 * contrato, dinheiro em reais, datas em dd/mm/aaaa e o número do contrato no
 * lugar do uuid. O resultado segue o formato que describeAuditDetails lê
 * (`changes` com de/para mais fatos soltos). Tolerante: dado de formato
 * desconhecido passa como veio.
 */
export function presentContractAuditDetails(details: unknown): unknown {
  if (!isRecord(details)) return details;

  const out: Record<string, unknown> = {};

  const changes = details.changes;
  if (isRecord(changes)) {
    const presented: Record<string, unknown> = {};
    for (const [field, change] of Object.entries(changes)) {
      const label = FIELD_LABEL[field] ?? field;
      if (isRecord(change) && ("from" in change || "to" in change)) {
        presented[label] = {
          from: presentFieldValue(field, change.from),
          to: presentFieldValue(field, change.to),
        };
      } else {
        presented[label] = presentFieldValue(field, change);
      }
    }
    out.changes = presented;
  }

  for (const [key, value] of Object.entries(details)) {
    if (key === "changes" || key === "contractId") continue;
    const label = FACT_LABEL[key] ?? key;
    if (key === "number" || key === "replacedBy" || key === "replaces" || key === "renewedFrom") {
      out[label] = typeof value === "number" ? contractCode(value) : value;
    } else if (key === "sizeBytes" && typeof value === "number") {
      out[label] = formatBytes(value);
    } else {
      out[label] = value;
    }
  }

  return out;
}
