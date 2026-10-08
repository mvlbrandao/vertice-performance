import { z } from "zod";
import { isValidCivilDate, MIN_REASON_LENGTH } from "@/lib/platform/contractRules";
import { parseReaisToCents } from "@/lib/utils/money";
import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";
import type { PlatformActionResult } from "@/lib/platform/auditNotice";

/**
 * Validação das entradas das ações de contrato. Pura (sem "server-only"): o
 * formulário e os testes usam as mesmas regras que o servidor aplica. O
 * servidor é quem decide — a validação do navegador é só conforto.
 *
 * As entradas vêm de FormData, ou seja, tudo é texto e qualquer campo pode
 * faltar; por isso cada campo aceita `undefined` e normaliza antes de validar.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Limites de texto. Espelham o que cabe numa linha de contrato, não o do banco (que é `text`). */
export const CONTRACT_LIMITS = {
  planName: 80,
  signerName: 120,
  signerRole: 80,
  termsVersion: 40,
  notes: 2000,
  reason: 500,
  maxAthletes: 100_000,
} as const;

export const BILLING_CYCLES = ["mensal", "trimestral", "semestral", "anual"] as const satisfies readonly ContractBillingCycle[];

const trimmed = z.string().optional().transform((value) => (value ?? "").trim());

/** Texto opcional: vazio vira null; passou do limite, recusa em vez de cortar em silêncio. */
function optionalText(max: number, label: string) {
  return trimmed
    .refine((value) => value.length <= max, { message: `${label}: no máximo ${max} caracteres.` })
    .transform((value) => (value === "" ? null : value));
}

function optionalDate(label: string) {
  return trimmed
    .refine((value) => value === "" || isValidCivilDate(value), {
      message: `${label}: informe uma data válida.`,
    })
    .transform((value) => (value === "" ? null : value));
}

const requiredDate = (label: string) =>
  trimmed
    .refine((value) => value !== "", { message: `${label}: informe a data.` })
    .refine((value) => value === "" || isValidCivilDate(value), {
      message: `${label}: informe uma data válida.`,
    });

const uuidField = (message: string) =>
  z
    .string()
    .optional()
    .refine((value) => isUuid(value ?? ""), { message })
    .transform((value) => value as string);

/** Caixa de seleção: o navegador manda "on" ou nada; os formulários do app mandam "true"/"false". */
const booleanField = (message: string) =>
  z
    .string()
    .optional()
    .refine((value) => ["true", "false", "on", "off", "1", "0"].includes((value ?? "").trim().toLowerCase()), {
      message,
    })
    .transform((value) => ["true", "on", "1"].includes((value ?? "").trim().toLowerCase()));

/** Mesma conversão, mas ausente vale `false`: para opções que o usuário só marca ("confirmo a substituição"). */
const flagField = z
  .string()
  .optional()
  .transform((value) => ["true", "on", "1"].includes((value ?? "").trim().toLowerCase()));

const priceField = trimmed.transform((value, ctx) => {
  if (value === "") {
    ctx.addIssue({ code: "custom", message: "Informe o valor do contrato (pode ser 0,00)." });
    return z.NEVER;
  }
  const cents = parseReaisToCents(value);
  if (cents === null) {
    ctx.addIssue({
      code: "custom",
      message: "Valor inválido. Use reais, por exemplo 1.499,90, sem sinal negativo e até R$ 1.000.000,00.",
    });
    return z.NEVER;
  }
  return cents;
});

/** Cota vazia = cota padrão da plataforma; preenchida, precisa ser inteiro maior que zero. */
const quotaField = trimmed.transform((value, ctx) => {
  if (value === "") return null;
  const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > CONTRACT_LIMITS.maxAthletes) {
    ctx.addIssue({
      code: "custom",
      message: `Cota inválida. Informe um inteiro de 1 a ${CONTRACT_LIMITS.maxAthletes} ou deixe vazio para usar a cota padrão.`,
    });
    return z.NEVER;
  }
  return parsed;
});

/** Campos do contrato que o administrador edita, já no formato das colunas. */
export interface ContractFields {
  plan_name: string;
  price_cents: number;
  max_athletes: number | null;
  billing_cycle: ContractBillingCycle;
  starts_on: string;
  ends_on: string | null;
  auto_renew: boolean;
  signed_on: string | null;
  signer_name: string | null;
  signer_role: string | null;
  terms_version: string | null;
  notes: string | null;
}

const fieldShape = {
  planName: trimmed
    .refine((value) => value !== "", { message: "Informe o nome do plano." })
    .refine((value) => value.length <= CONTRACT_LIMITS.planName, {
      message: `Nome do plano: no máximo ${CONTRACT_LIMITS.planName} caracteres.`,
    }),
  priceReais: priceField,
  maxAthletes: quotaField,
  billingCycle: z
    .string()
    .optional()
    .refine((value) => (BILLING_CYCLES as readonly string[]).includes(value ?? ""), {
      message: "Escolha o ciclo de cobrança.",
    })
    .transform((value) => value as ContractBillingCycle),
  startsOn: requiredDate("Início"),
  endsOn: optionalDate("Fim"),
  autoRenew: booleanField("Informe se renova automaticamente."),
  signedOn: optionalDate("Data da assinatura"),
  signerName: optionalText(CONTRACT_LIMITS.signerName, "Nome de quem assinou"),
  signerRole: optionalText(CONTRACT_LIMITS.signerRole, "Cargo de quem assinou"),
  termsVersion: optionalText(CONTRACT_LIMITS.termsVersion, "Versão dos termos"),
  notes: optionalText(CONTRACT_LIMITS.notes, "Notas internas"),
};

type ParsedFields = {
  [K in keyof typeof fieldShape]: z.output<(typeof fieldShape)[K]>;
};

function toFields(value: ParsedFields): ContractFields {
  return {
    plan_name: value.planName,
    price_cents: value.priceReais,
    max_athletes: value.maxAthletes,
    billing_cycle: value.billingCycle,
    starts_on: value.startsOn,
    ends_on: value.endsOn,
    auto_renew: value.autoRenew,
    signed_on: value.signedOn,
    signer_name: value.signerName,
    signer_role: value.signerRole,
    terms_version: value.termsVersion,
    notes: value.notes,
  };
}

/** Fim antes do início quebraria a restrição do banco (club_contracts_period_check) com erro críptico. */
function checkPeriod(value: { startsOn: string; endsOn: string | null }, ctx: z.RefinementCtx) {
  if (value.endsOn !== null && value.endsOn < value.startsOn) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "A data de fim não pode ser anterior à de início.",
    });
  }
}

export const createContractSchema = z
  .object({
    clubId: uuidField("Escolha o clube."),
    status: z
      .string()
      .optional()
      .transform((value) => (value ?? "").trim() || "rascunho")
      .refine((value) => value === "rascunho" || value === "vigente", {
        message: "Um contrato novo só pode nascer como rascunho ou vigente.",
      })
      .transform((value) => value as Extract<ContractStatus, "rascunho" | "vigente">),
    replace: flagField,
    ...fieldShape,
  })
  .superRefine(checkPeriod)
  .transform((value) => ({
    clubId: value.clubId,
    status: value.status,
    replace: value.replace,
    fields: toFields(value),
  }));

export type CreateContractInput = z.output<typeof createContractSchema>;

export const updateContractSchema = z
  .object({
    contractId: uuidField("Contrato inválido."),
    ...fieldShape,
  })
  .superRefine(checkPeriod)
  .transform((value) => ({
    contractId: value.contractId,
    fields: toFields(value),
  }));

export type UpdateContractInput = z.output<typeof updateContractSchema>;

function reasonField(requiredMessage: string) {
  return trimmed
    .refine((value) => value.length >= MIN_REASON_LENGTH, { message: requiredMessage })
    .refine((value) => value.length <= CONTRACT_LIMITS.reason, {
      message: `Motivo: no máximo ${CONTRACT_LIMITS.reason} caracteres.`,
    });
}

export const closeContractSchema = z.object({
  contractId: uuidField("Contrato inválido."),
  reason: reasonField(`Informe o motivo do encerramento (mínimo ${MIN_REASON_LENGTH} letras).`),
});

export const cancelContractSchema = z.object({
  contractId: uuidField("Contrato inválido."),
  reason: reasonField(`Informe o motivo do cancelamento (mínimo ${MIN_REASON_LENGTH} letras).`),
});

export const activateContractSchema = z.object({
  contractId: uuidField("Contrato inválido."),
  replace: flagField,
});

export const renewContractSchema = z.object({
  contractId: uuidField("Contrato inválido."),
});

export const contractIdSchema = z.object({
  contractId: uuidField("Contrato inválido."),
});

export const confirmDocumentSchema = z.object({
  contractId: uuidField("Contrato inválido."),
  path: trimmed.refine((value) => value !== "" && value.length <= 300, {
    message: "Arquivo inválido. Envie o PDF de novo.",
  }),
});

/** FormData -> objeto de texto. Arquivos não entram: nenhuma ação recebe arquivo (o PDF vai direto ao storage). */
export function formDataToRecord(formData: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export interface ValidationSummary {
  /** Primeira mensagem, para quem mostra um erro só. */
  error: string;
  /** Mensagem por campo (a primeira de cada), para o formulário marcar o campo. */
  fieldErrors: Record<string, string>;
}

export function summarizeIssues(error: z.ZodError): ValidationSummary {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
}

/**
 * Resultado das ações de contrato: o de sempre (erro ou sucesso com aviso da
 * trilha) mais o que a tela precisa para seguir.
 */
export interface ContractActionResult extends PlatformActionResult {
  /** Erro por campo (nome do campo do formulário). */
  fieldErrors?: Record<string, string>;
  /** Contrato criado ou renovado: a tela leva a pessoa até ele. */
  contractId?: string;
  /**
   * Ativar ou criar como vigente quando o clube já tem outro vigente: nada foi
   * feito; a tela pede a confirmação e repete a chamada com replace=true.
   */
  needsReplaceConfirmation?: { currentNumber: number };
}

/** Passe para enviar o PDF direto ao storage (a action não recebe o arquivo). */
export interface ContractUploadTicket extends PlatformActionResult {
  upload?: { path: string; token: string; maxBytes: number };
}

export interface ContractDocumentLink {
  error?: string;
  url?: string;
}
