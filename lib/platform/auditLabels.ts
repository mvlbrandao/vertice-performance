import { CLUB_TIME_ZONE } from "@/lib/utils/date";

/**
 * Rótulos e formatação da trilha de auditoria da plataforma. Pura (sem
 * "server-only"): vai para a tela de auditoria e para os testes.
 *
 * Ação segue "<entidade>.<verbo>", o mesmo formato que a restrição da tabela
 * exige (platform_audit_log.action ~ '^[a-z_]+\.[a-z_]+$').
 */

export const AUDIT_ACTION_PATTERN = /^[a-z_]+\.[a-z_]+$/;

export function isValidAuditAction(action: unknown): action is string {
  return typeof action === "string" && AUDIT_ACTION_PATTERN.test(action);
}

/** Entidades, para o filtro da tela. Ação com entidade desconhecida ainda aparece. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  settings: "Plano padrão",
  club: "Clubes",
  contract: "Contratos",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "settings.update": "Plano padrão alterado",
  "club.extend_trial": "Teste estendido",
  "club.grant_courtesy": "Cortesia concedida",
  "club.revoke_courtesy": "Cortesia removida",
  "club.reset_payment_promise": "Promessa de pagamento devolvida",
  "club.set_overrides": "Cota ou preço próprio alterado",
  "club.set_status": "Situação do clube alterada",
  "club.start_subscription": "Cobrança recorrente iniciada",
  "club.cancel_subscription": "Cobrança recorrente cancelada",
};

/** Ação sem rótulo cadastrado aparece com o código cru, nunca some nem quebra. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditEntityOf(action: string): string {
  return action.split(".")[0] ?? action;
}

const FIELD_LABELS: Record<string, string> = {
  plan_name: "Nome do plano",
  price_cents: "Mensalidade",
  trial_days: "Dias de teste",
  max_athletes: "Atletas por licença",
  retention_days: "Retenção após cancelar (dias)",
  status: "Situação",
  trial_ends_at: "Fim do teste",
  courtesy_until: "Cortesia até",
  courtesy_reason: "Motivo da cortesia",
  max_athletes_override: "Cota própria de atletas",
  price_cents_override: "Preço próprio",
  payment_promise_used_at: "Promessa de pagamento usada em",
  canceled_at: "Cancelado em",
  dias: "Dias adicionados",
  billing_type: "Forma de cobrança",
  amount_cents: "Valor",
  asaas_subscription_id: "Assinatura no Asaas",
  asaas: "Retorno do Asaas",
  customer: "Cliente no Asaas",
  club: "Clube",
};

export function auditFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

const STATUS_LABELS: Record<string, string> = {
  trial: "Em teste",
  ativo: "Ativo",
  atrasado: "Atrasado",
  bloqueado: "Bloqueado",
  cancelado: "Cancelado",
  rascunho: "Rascunho",
  vigente: "Vigente",
  encerrado: "Encerrado",
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão",
  PIX: "Pix",
  BOLETO: "Boleto",
  UNDEFINED: "A escolher",
};

const ASAAS_RESULT_LABELS: Record<string, string> = {
  cancelada: "Assinatura cancelada",
  nao_encontrada: "Já não existia no Asaas",
  sem_assinatura: "O clube não tinha assinatura",
};

const CUSTOMER_LABELS: Record<string, string> = {
  novo: "Criado agora",
  existente: "Já existia",
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Campos gravados como "fim do dia" (T23:59:59Z): só a data interessa. */
const DATE_ONLY_FIELDS = new Set(["trial_ends_at", "courtesy_until"]);

export function formatAuditDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** "08/10/2026 12:00:00" no horário de Brasília. Instantes são UTC no banco. */
export function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Texto de um valor para a coluna "de → para". Vazio vira "—". */
export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (typeof value === "number") {
    // price_cents_override também é centavos; só o sufixo "_cents" não pega.
    return /_cents(_override)?$/.test(field) ? BRL.format(value / 100) : String(value);
  }

  if (typeof value === "string") {
    if (field === "status") return STATUS_LABELS[value] ?? value;
    if (field === "billing_type") return BILLING_TYPE_LABELS[value] ?? value;
    if (field === "asaas") return ASAAS_RESULT_LABELS[value] ?? value;
    if (field === "customer") return CUSTOMER_LABELS[value] ?? value;
    if (ISO_TIMESTAMP.test(value)) {
      return DATE_ONLY_FIELDS.has(field) ? formatAuditDate(value) : formatAuditTime(value);
    }
    return value;
  }

  return JSON.stringify(value);
}

export interface AuditDetailLine {
  label: string;
  /** Presentes nas mudanças ("de → para"). */
  from?: string;
  to?: string;
  /** Presente nos fatos soltos (ex.: "Dias adicionados: 15"). */
  value?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isChange(value: unknown): value is { from?: unknown; to?: unknown } {
  return isRecord(value) && ("from" in value || "to" in value);
}

/**
 * Transforma o `details` gravado em linhas legíveis. Tolerante de propósito:
 * a trilha é lida por anos, e linha antiga, de outro formato ou editada à mão
 * no banco não pode derrubar a tela inteira.
 *
 * `changes` ({ campo: { from, to } }, o formato de diffFields) vira linhas
 * "de → para"; as demais chaves viram fatos soltos.
 */
export function describeAuditDetails(details: unknown): AuditDetailLine[] {
  if (details === null || details === undefined) return [];
  if (!isRecord(details)) {
    return [{ label: "Detalhe", value: formatAuditValue("", details) }];
  }

  const lines: AuditDetailLine[] = [];

  const changes = details.changes;
  if (isRecord(changes)) {
    for (const [field, change] of Object.entries(changes)) {
      if (isChange(change)) {
        lines.push({
          label: auditFieldLabel(field),
          from: formatAuditValue(field, change.from),
          to: formatAuditValue(field, change.to),
        });
      } else {
        lines.push({ label: auditFieldLabel(field), value: formatAuditValue(field, change) });
      }
    }
  }

  for (const [key, value] of Object.entries(details)) {
    if (key === "changes" && isRecord(changes)) continue;
    lines.push({ label: auditFieldLabel(key), value: formatAuditValue(key, value) });
  }

  return lines;
}
