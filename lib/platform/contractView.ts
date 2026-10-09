import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";
import { CYCLE_MONTHS, addMonthsCivil, type ContractExpiry } from "@/lib/platform/contractRules";
import { centsToInput, formatCents } from "@/lib/utils/money";
import { somaDias } from "@/lib/utils/date";

/**
 * Apresentação dos contratos (texto e valores iniciais de formulário). Pura,
 * sem "server-only": serve às telas de servidor, ao formulário (cliente) e
 * aos testes. As regras de negócio continuam em contractRules.ts.
 */

export type BadgeTone = "green" | "amber" | "clay" | "sky" | "dark";

export const STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  vigente: "green",
  rascunho: "amber",
  encerrado: "dark",
  cancelado: "clay",
};

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-08" -> "08/10/2026". Texto que não é data civil passa como veio; vazio vira "—". */
export function formatCivilBR(value: string | null | undefined): string {
  if (!value) return "—";
  const match = CIVIL_DATE.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** "01/10/2026 a 31/10/2026", ou "desde 01/10/2026 (prazo indeterminado)". */
export function periodLabel(startsOn: string, endsOn: string | null): string {
  return endsOn
    ? `${formatCivilBR(startsOn)} a ${formatCivilBR(endsOn)}`
    : `desde ${formatCivilBR(startsOn)} (prazo indeterminado)`;
}

const CYCLE_UNIT: Record<ContractBillingCycle, string> = {
  mensal: "mês",
  trimestral: "trimestre",
  semestral: "semestre",
  anual: "ano",
};

/** "R$ 1.200,00 por ano". */
export function pricePerCycleLabel(priceCents: number, cycle: ContractBillingCycle): string {
  return `${formatCents(priceCents)} por ${CYCLE_UNIT[cycle]}`;
}

/** Selo de prazo de um contrato vigente; null quando não há o que destacar. */
export function expiryBadge(expiry: ContractExpiry): { label: string; tone: BadgeTone } | null {
  const { state, days } = expiry;
  if (state === "indeterminado") return { label: "Prazo indeterminado", tone: "dark" };
  if (state === "em_dia" || days === null) return null;
  if (state === "vencido") {
    const atraso = -days;
    return { label: `Vencido há ${atraso} ${atraso === 1 ? "dia" : "dias"}`, tone: "clay" };
  }
  if (days === 0) return { label: "Vence hoje", tone: "clay" };
  if (days === 1) return { label: "Vence amanhã", tone: "clay" };
  return { label: `Vence em ${days} dias`, tone: state === "vence_30" ? "clay" : "amber" };
}

/** Texto do rodapé da lista quando só parte dos contratos é desenhada. */
export function listCapNotice(shown: number, total: number): string | null {
  return total > shown ? `Mostrando ${shown} de ${total} contratos. Refine os filtros para ver os demais.` : null;
}

// ---------------------------------------------------------------------------
// Valores iniciais do formulário (tudo texto, como o navegador envia)
// ---------------------------------------------------------------------------

export interface ContractFormValues {
  planName: string;
  priceReais: string;
  maxAthletes: string;
  billingCycle: ContractBillingCycle;
  startsOn: string;
  endsOn: string;
  autoRenew: "true" | "false";
  signedOn: string;
  signerName: string;
  signerRole: string;
  termsVersion: string;
  notes: string;
}

interface ContractRowForForm {
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

/**
 * O que o envio do formulário de criação faz. Criar já vigente grava o
 * rascunho e depois tenta ativá-lo; se a ativação falha (rede, ou outra pessoa
 * ativou um contrato do clube no meio), o rascunho fica de pé. Repetir o envio
 * com `create` gravaria um SEGUNDO contrato com os mesmos dados; por isso, com
 * um rascunho pendente, a nova tentativa só tenta ativar aquele.
 */
export type CreateSubmitStep = { kind: "create" } | { kind: "activate-draft"; contractId: string };

export function createSubmitStep(orphanDraftId: string | null): CreateSubmitStep {
  return orphanDraftId ? { kind: "activate-draft", contractId: orphanDraftId } : { kind: "create" };
}

/** Fim sugerido para um início e um ciclo: início + N meses - 1 dia (mesma regra da renovação). */
export function suggestedEndsOn(startsOn: string, cycle: ContractBillingCycle): string | null {
  try {
    return somaDias(addMonthsCivil(startsOn, CYCLE_MONTHS[cycle]), -1);
  } catch {
    // Data digitada pela metade: sem sugestão, sem erro na tela.
    return null;
  }
}

export function contractToFormValues(row: ContractRowForForm): ContractFormValues {
  return {
    planName: row.plan_name,
    priceReais: centsToInput(row.price_cents),
    maxAthletes: row.max_athletes === null ? "" : String(row.max_athletes),
    billingCycle: row.billing_cycle,
    startsOn: row.starts_on,
    endsOn: row.ends_on ?? "",
    autoRenew: row.auto_renew ? "true" : "false",
    signedOn: row.signed_on ?? "",
    signerName: row.signer_name ?? "",
    signerRole: row.signer_role ?? "",
    termsVersion: row.terms_version ?? "",
    notes: row.notes ?? "",
  };
}

/**
 * Contrato novo: plano e preço vêm do plano padrão da plataforma, que é o que
 * o clube pagaria sem acordo especial; a cota fica vazia (= acompanha a cota
 * padrão do plano, mesmo que ela mude depois). Começa hoje, com o fim
 * sugerido para o ciclo mensal.
 */
export function defaultNewContractValues(
  settings: { planName: string; priceCents: number },
  todayISO: string,
): ContractFormValues {
  return {
    planName: settings.planName,
    priceReais: centsToInput(settings.priceCents),
    maxAthletes: "",
    billingCycle: "mensal",
    startsOn: todayISO,
    endsOn: suggestedEndsOn(todayISO, "mensal") ?? "",
    autoRenew: "true",
    signedOn: "",
    signerName: "",
    signerRole: "",
    termsVersion: "",
    notes: "",
  };
}
