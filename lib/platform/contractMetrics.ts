import { classifyExpiry, monthlyEquivalentCents } from "@/lib/platform/contractRules";
import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";

/**
 * Números da faixa de indicadores de /admin/contratos. Pura: é o que o dono
 * lê para decidir (quanto entra por mês, o que vence), então a conta é testada.
 */
export interface MetricContract {
  status: ContractStatus;
  price_cents: number;
  billing_cycle: ContractBillingCycle;
  ends_on: string | null;
  document_path: string | null;
}

export interface ContractKpis {
  vigentes: number;
  /** Soma do equivalente mensal dos vigentes (contrato anual entra dividido por 12). */
  receitaMensalCents: number;
  /** Vigentes que terminam de hoje a 30 dias. */
  vencem30: number;
  /** Vigentes cujo fim já passou: somem do "vencem em 30 dias", mas não podem passar despercebidos. */
  vencidos: number;
  /** Vigentes sem o PDF assinado anexado. */
  semDocumento: number;
  rascunhos: number;
}

export function computeContractKpis(contracts: readonly MetricContract[], todayISO: string): ContractKpis {
  const kpis: ContractKpis = {
    vigentes: 0,
    receitaMensalCents: 0,
    vencem30: 0,
    vencidos: 0,
    semDocumento: 0,
    rascunhos: 0,
  };

  for (const contract of contracts) {
    if (contract.status === "rascunho") {
      kpis.rascunhos += 1;
      continue;
    }
    if (contract.status !== "vigente") continue;

    kpis.vigentes += 1;
    kpis.receitaMensalCents += monthlyEquivalentCents(contract.price_cents, contract.billing_cycle);
    if (!contract.document_path) kpis.semDocumento += 1;

    const { state } = classifyExpiry(contract, todayISO);
    if (state === "vence_30") kpis.vencem30 += 1;
    if (state === "vencido") kpis.vencidos += 1;
  }

  return kpis;
}
