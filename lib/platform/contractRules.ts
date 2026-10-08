import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";

/**
 * Regras puras de contrato (sem banco, sem "server-only") para poderem ser
 * testadas e usadas tanto nas telas de contrato quanto na visão geral e nos
 * alertas. Datas são datas civis "YYYY-MM-DD" (fuso do clube), nunca
 * instantes — por isso a aritmética de dias passa por Date.UTC e não por
 * fuso local.
 */

export const CYCLE_MONTHS: Record<ContractBillingCycle, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const CYCLE_LABEL: Record<ContractBillingCycle, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const STATUS_LABEL: Record<ContractStatus, string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/**
 * Receita mensal equivalente de um contrato. price_cents é o valor de CADA
 * ciclo (anual de R$ 1.200 = 120000), então comparar com a licença — que é
 * mensal — e somar receita recorrente exige normalizar para mês.
 */
export function monthlyEquivalentCents(priceCents: number, cycle: ContractBillingCycle): number {
  return Math.round(priceCents / CYCLE_MONTHS[cycle]);
}

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Dias corridos de `fromISO` até `toISO` (negativo se `toISO` já passou). */
export function diffDays(fromISO: string, toISO: string): number {
  return Math.round(toUtcDay(toISO) - toUtcDay(fromISO));
}

export type ExpiryState =
  | "indeterminado"
  | "em_dia"
  | "vence_90"
  | "vence_60"
  | "vence_30"
  | "vencido";

export interface ContractExpiry {
  state: ExpiryState;
  /** Dias até o fim (negativo = vencido há N dias). null se prazo indeterminado. */
  days: number | null;
}

/**
 * Situação de prazo. Só faz sentido para contrato vigente: rascunho ainda não
 * começou e encerrado/cancelado já acabou, então qualquer um deles devolve
 * "em_dia" sem dias — a tela não deve alarmar por contrato que não conta.
 */
export function classifyExpiry(
  contract: { status: ContractStatus; ends_on: string | null },
  todayISO: string,
): ContractExpiry {
  if (contract.status !== "vigente") return { state: "em_dia", days: null };
  if (!contract.ends_on) return { state: "indeterminado", days: null };

  const days = diffDays(todayISO, contract.ends_on);
  if (days < 0) return { state: "vencido", days };
  if (days <= 30) return { state: "vence_30", days };
  if (days <= 60) return { state: "vence_60", days };
  if (days <= 90) return { state: "vence_90", days };
  return { state: "em_dia", days };
}

/** Transições permitidas. Encerrado e cancelado são estados finais. */
export const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  rascunho: ["vigente", "cancelado"],
  vigente: ["encerrado", "cancelado"],
  encerrado: [],
  cancelado: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
