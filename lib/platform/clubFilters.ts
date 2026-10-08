import type { ClubStatus } from "@/lib/types/database";

/**
 * Filtros da lista de clubes do administrador. Vêm da URL (searchParams), ou
 * seja, de fora: tudo é validado aqui antes de virar critério.
 */
export const CLUB_STATUS_OPTIONS: readonly ClubStatus[] = [
  "trial",
  "ativo",
  "atrasado",
  "bloqueado",
  "cancelado",
];

export const CLUB_STATUS_LABEL: Record<ClubStatus, string> = {
  trial: "Em teste",
  ativo: "Ativos",
  atrasado: "Atrasados",
  bloqueado: "Bloqueados",
  cancelado: "Cancelados",
};

export interface ClubFilters {
  q: string;
  status: ClubStatus | "todos";
}

type Raw = string | string[] | undefined;

const MAX_QUERY = 80;

function first(value: Raw): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseClubFilters(raw: { q?: Raw; status?: Raw }): ClubFilters {
  const status = first(raw.status);
  return {
    q: first(raw.q).trim().slice(0, MAX_QUERY),
    status: (CLUB_STATUS_OPTIONS as readonly string[]).includes(status)
      ? (status as ClubStatus)
      : "todos",
  };
}

/** Sem acento e sem diferenciar maiúsculas: "sao" acha "São Paulo FC". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterClubs<T extends { name: string; slug: string; status: ClubStatus }>(
  clubs: readonly T[],
  filters: ClubFilters,
): T[] {
  const needle = normalizeSearch(filters.q);
  return clubs.filter((club) => {
    if (filters.status !== "todos" && club.status !== filters.status) return false;
    if (!needle) return true;
    return normalizeSearch(club.name).includes(needle) || normalizeSearch(club.slug).includes(needle);
  });
}
