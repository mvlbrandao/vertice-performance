import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

/**
 * Leitura de contratos (club_contracts, migração 0073). Só a plataforma
 * enxerga esta tabela — todo acesso passa pelo client de service role e
 * quem chama já precisa ter passado por requirePlatformAdmin().
 *
 * `migrationPending` existe porque o código sobe antes da migração em
 * produção: sem ela a tela de admin inteira cairia em erro 500 até alguém
 * aplicar o SQL. Com ela, a tela avisa o que falta fazer.
 */
export type ClubContractRow = Database["public"]["Tables"]["club_contracts"]["Row"];

export interface ContractsResult<T> {
  data: T;
  migrationPending: boolean;
}

/** PostgREST responde PGRST205 (tabela fora do cache) ou 42P01 (relação inexistente). */
export function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /does not exist|could not find the table/i.test(error.message ?? "")
  );
}

export async function listClubContracts(
  clubId: string,
): Promise<ContractsResult<ClubContractRow[]>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_contracts")
    .select("*")
    .eq("club_id", clubId)
    .order("starts_on", { ascending: false })
    .order("number", { ascending: false });

  if (isMissingRelation(error)) return { data: [], migrationPending: true };
  if (error) throw new Error(`Falha ao ler contratos do clube: ${error.message}`);
  return { data: data ?? [], migrationPending: false };
}

/** Todos os contratos (um clube raramente passa de poucos), mais recentes primeiro. */
export async function listAllContracts(): Promise<ContractsResult<ClubContractRow[]>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_contracts")
    .select("*")
    .order("starts_on", { ascending: false })
    .order("number", { ascending: false })
    .limit(1000);

  if (isMissingRelation(error)) return { data: [], migrationPending: true };
  if (error) throw new Error(`Falha ao ler contratos: ${error.message}`);
  return { data: data ?? [], migrationPending: false };
}

/** Contrato vigente de cada clube, indexado por club_id (no máximo um por clube). */
export async function getActiveContractsByClub(): Promise<
  ContractsResult<Map<string, ClubContractRow>>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_contracts")
    .select("*")
    .eq("status", "vigente")
    .limit(5000);

  if (isMissingRelation(error)) return { data: new Map(), migrationPending: true };
  if (error) throw new Error(`Falha ao ler contratos vigentes: ${error.message}`);
  return { data: new Map((data ?? []).map((c) => [c.club_id, c])), migrationPending: false };
}
