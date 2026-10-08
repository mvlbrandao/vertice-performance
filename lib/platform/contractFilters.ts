import { classifyExpiry } from "@/lib/platform/contractRules";
import { normalizeSearch } from "@/lib/platform/clubFilters";
import type { ContractBillingCycle, ContractStatus } from "@/lib/types/database";

/**
 * Filtros da lista de contratos do administrador. Vêm da URL (searchParams),
 * ou seja, de fora: tudo é validado aqui antes de virar critério. Mesmo
 * desenho de clubFilters.ts.
 */
export const CONTRACT_STATUS_OPTIONS: readonly ContractStatus[] = [
  "vigente",
  "rascunho",
  "encerrado",
  "cancelado",
];

export const EXPIRY_OPTIONS = ["30", "60", "90", "vencidos"] as const;
export type ExpiryFilter = (typeof EXPIRY_OPTIONS)[number];

export const EXPIRY_FILTER_LABEL: Record<ExpiryFilter, string> = {
  "30": "Vencem em 30 dias",
  "60": "Vencem em 60 dias",
  "90": "Vencem em 90 dias",
  vencidos: "Vencidos",
};

export const CYCLE_OPTIONS: readonly ContractBillingCycle[] = ["mensal", "trimestral", "semestral", "anual"];

export interface ContractFilters {
  q: string;
  status: ContractStatus | "todos";
  vencimento: ExpiryFilter | "todos";
  ciclo: ContractBillingCycle | "todos";
  /** "sem": só contratos sem o PDF assinado anexado. */
  documento: "sem" | "todos";
}

type Raw = string | string[] | undefined;

const MAX_QUERY = 80;

function first(value: Raw): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function oneOf<T extends string>(value: string, options: readonly T[]): T | null {
  return (options as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseContractFilters(raw: {
  q?: Raw;
  status?: Raw;
  vencimento?: Raw;
  ciclo?: Raw;
  documento?: Raw;
}): ContractFilters {
  return {
    q: first(raw.q).trim().slice(0, MAX_QUERY),
    status: oneOf(first(raw.status), CONTRACT_STATUS_OPTIONS) ?? "todos",
    vencimento: oneOf(first(raw.vencimento), EXPIRY_OPTIONS) ?? "todos",
    ciclo: oneOf(first(raw.ciclo), CYCLE_OPTIONS) ?? "todos",
    documento: first(raw.documento) === "sem" ? "sem" : "todos",
  };
}

export function hasActiveContractFilters(filters: ContractFilters): boolean {
  return (
    filters.q !== "" ||
    filters.status !== "todos" ||
    filters.vencimento !== "todos" ||
    filters.ciclo !== "todos" ||
    filters.documento !== "todos"
  );
}

/** Endereço da lista com os filtros; o que for "todos"/vazio não vai para a URL. */
export function contractsHref(filters: Partial<ContractFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "todos") params.set("status", filters.status);
  if (filters.vencimento && filters.vencimento !== "todos") params.set("vencimento", filters.vencimento);
  if (filters.ciclo && filters.ciclo !== "todos") params.set("ciclo", filters.ciclo);
  if (filters.documento === "sem") params.set("documento", "sem");
  const qs = params.toString();
  return qs ? `/admin/contratos?${qs}` : "/admin/contratos";
}

export interface FilterableContract {
  number: number;
  status: ContractStatus;
  billing_cycle: ContractBillingCycle;
  ends_on: string | null;
  document_path: string | null;
  club_name: string;
  club_slug: string;
}

/**
 * "CT-7", "ct7" e "7" acham o contrato 7: quem fala o número ao telefone não
 * digita o prefixo. A comparação é exata de propósito: por texto, "CT-1"
 * traria também CT-10 a CT-19.
 */
const CONTRACT_NUMBER_QUERY = /^(?:ct-?)?(\d+)$/i;

/**
 * O filtro de vencimento só enxerga contratos VIGENTES: rascunho não começou e
 * encerrado/cancelado já acabou (classifyExpiry devolve "em_dia" sem dias para
 * eles). "30/60/90" são cumulativos ("vencem em até N dias") e incluem o que
 * vence hoje; "vencidos" é o vigente cujo fim já passou.
 */
function matchesExpiry(
  contract: { status: ContractStatus; ends_on: string | null },
  filter: ExpiryFilter,
  todayISO: string,
): boolean {
  const { state, days } = classifyExpiry(contract, todayISO);
  if (filter === "vencidos") return state === "vencido";
  if (days === null || days < 0) return false;
  return days <= Number(filter);
}

export function filterContracts<T extends FilterableContract>(
  contracts: readonly T[],
  filters: ContractFilters,
  todayISO: string,
): T[] {
  const needle = normalizeSearch(filters.q);
  const numberQuery = CONTRACT_NUMBER_QUERY.exec(filters.q.trim());
  const wantedNumber = numberQuery ? Number(numberQuery[1]) : null;

  const result = contracts.filter((contract) => {
    if (filters.status !== "todos" && contract.status !== filters.status) return false;
    if (filters.ciclo !== "todos" && contract.billing_cycle !== filters.ciclo) return false;
    if (filters.documento === "sem" && contract.document_path) return false;
    if (filters.vencimento !== "todos" && !matchesExpiry(contract, filters.vencimento, todayISO)) {
      return false;
    }
    if (!needle) return true;
    if (wantedNumber !== null && contract.number === wantedNumber) return true;
    return (
      normalizeSearch(contract.club_name).includes(needle) ||
      normalizeSearch(contract.club_slug).includes(needle)
    );
  });

  // Filtrando por vencimento, o que acaba primeiro vem primeiro: é a ordem em que se age.
  if (filters.vencimento !== "todos") {
    result.sort((a, b) => (a.ends_on ?? "9999-12-31").localeCompare(b.ends_on ?? "9999-12-31") || a.number - b.number);
  }
  return result;
}
