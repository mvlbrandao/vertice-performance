import type { ClubContractRow, ContractClub } from "@/lib/platform/contracts";
import {
  compareWithLicense,
  licenseWithoutActiveContract,
  type ContractDivergence,
} from "@/lib/platform/contractRules";
import { buildLicenseSnapshot, type LicenseDefaults } from "@/lib/platform/licenseSnapshot";

/**
 * Junta contratos e clubes para a lista de /admin/contratos. Pura (sem
 * "server-only"): a leitura paginada fica em contracts.ts e aqui só se
 * cruzam os dados em memória, o que dá para provar com testes.
 */

export interface ContractListRow extends ClubContractRow {
  club_name: string;
  club_slug: string;
  /** Divergências com a licença do clube (só para contrato vigente). */
  divergences: ContractDivergence[];
}

export const REMOVED_CLUB_NAME = "Clube removido";

export function buildContractListRows(
  contracts: readonly ClubContractRow[],
  clubs: readonly ContractClub[],
  defaults: LicenseDefaults,
  now: Date = new Date(),
): ContractListRow[] {
  const byId = new Map(clubs.map((club) => [club.id, club]));

  return contracts.map((contract) => {
    const club = byId.get(contract.club_id);
    // A lista compara só o vigente: rascunho diverge por definição (ainda não
    // vale) e encerrado é histórico. A tela do contrato explica o rascunho.
    const divergences =
      club && contract.status === "vigente"
        ? compareWithLicense(contract, buildLicenseSnapshot(club, defaults, now))
        : [];
    return {
      ...contract,
      club_name: club?.name ?? REMOVED_CLUB_NAME,
      club_slug: club?.slug ?? "",
      divergences,
    };
  });
}

export interface ClubWithoutContract {
  id: string;
  name: string;
  /** "ativo" ou "atrasado": diz por que o clube deveria ter contrato. */
  status: string;
}

/**
 * Clubes cuja licença é paga mas que não têm contrato vigente: o acordo
 * comercial não está registrado. Demonstração fica de fora (não há acordo).
 */
export function clubsWithoutActiveContract(
  clubs: readonly ContractClub[],
  contracts: readonly Pick<ClubContractRow, "club_id" | "status">[],
  defaults: LicenseDefaults,
  now: Date = new Date(),
): ClubWithoutContract[] {
  const withActive = new Set(contracts.filter((c) => c.status === "vigente").map((c) => c.club_id));
  return clubs
    .filter((club) => !withActive.has(club.id))
    .filter((club) => licenseWithoutActiveContract(buildLicenseSnapshot(club, defaults, now)) !== null)
    .map((club) => ({ id: club.id, name: club.name, status: club.status }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
