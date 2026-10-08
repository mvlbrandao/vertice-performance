import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerTodasAsPaginas } from "@/lib/utils/chunk";
import { escapeLike } from "@/lib/platform/auditQuery";
import { isUuid } from "@/lib/platform/contractSchema";
import type { ClubStatus, Database } from "@/lib/types/database";

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

/**
 * Todos os contratos, mais recentes primeiro. Lê em páginas: o PostgREST corta
 * TODA resposta em 1000 linhas e um `.limit(5000)` não adianta, a resposta
 * simplesmente vem truncada, sem erro. `number` é único, então a ordenação é
 * estável entre as páginas.
 */
export async function listAllContracts(): Promise<ContractsResult<ClubContractRow[]>> {
  const admin = createAdminClient();
  const { linhas, erro } = await lerTodasAsPaginas<ClubContractRow>((de, ate) =>
    admin
      .from("club_contracts")
      .select("*")
      .order("starts_on", { ascending: false })
      .order("number", { ascending: false })
      .range(de, ate),
  );

  if (erro !== null && isMissingRelation({ message: erro })) return { data: [], migrationPending: true };
  // Lista parcial como se fosse completa faria os indicadores mentirem.
  if (erro !== null) throw new Error(`Falha ao ler contratos: ${erro}`);
  return { data: linhas, migrationPending: false };
}

/** Contrato vigente de cada clube, indexado por club_id (no máximo um por clube). */
export async function getActiveContractsByClub(): Promise<
  ContractsResult<Map<string, ClubContractRow>>
> {
  const admin = createAdminClient();
  const { linhas, erro } = await lerTodasAsPaginas<ClubContractRow>((de, ate) =>
    admin
      .from("club_contracts")
      .select("*")
      .eq("status", "vigente")
      .order("number")
      .range(de, ate),
  );

  if (erro !== null && isMissingRelation({ message: erro })) {
    return { data: new Map(), migrationPending: true };
  }
  if (erro !== null) throw new Error(`Falha ao ler contratos vigentes: ${erro}`);
  return { data: new Map(linhas.map((c) => [c.club_id, c])), migrationPending: false };
}

/**
 * Colunas do clube que as telas de contrato usam: o nome e o que a licença
 * precisa para a comparação. Sem CPF/CNPJ, e-mail nem dados de cobrança.
 */
const CONTRACT_CLUB_COLUMNS =
  "id, name, slug, status, trial_ends_at, courtesy_until, max_athletes_override, price_cents_override, is_demo" as const;

export interface ContractClub {
  id: string;
  name: string;
  slug: string;
  status: ClubStatus;
  trial_ends_at: string | null;
  courtesy_until: string | null;
  max_athletes_override: number | null;
  price_cents_override: number | null;
  is_demo: boolean;
}

/** Todos os clubes (em páginas), por nome. Para o seletor de clube e para cruzar com os contratos. */
export async function listClubsForContracts(): Promise<ContractClub[]> {
  const admin = createAdminClient();
  const { linhas, erro } = await lerTodasAsPaginas<ContractClub>((de, ate) =>
    admin.from("clubs").select(CONTRACT_CLUB_COLUMNS).order("name").order("id").range(de, ate),
  );
  // Sem os clubes a tela mostraria contratos sem dono; falhar é mais honesto.
  if (erro !== null) throw new Error(`Falha ao ler os clubes: ${erro}`);
  return linhas;
}

export interface ContractWithClub {
  contract: ClubContractRow;
  /** null se o clube já foi expurgado (a linha do contrato cai junto, mas a leitura pode pegar a janela). */
  club: ContractClub | null;
}

/**
 * Um contrato pelo id, com o clube. Id malformado devolve null sem consultar:
 * o Postgres responderia 22P02 (uuid inválido) e a tela viraria erro 500 em
 * vez de "não encontrado".
 */
export async function getContractWithClub(
  contractId: string,
): Promise<ContractsResult<ContractWithClub | null>> {
  if (!isUuid(contractId)) return { data: null, migrationPending: false };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (isMissingRelation(error)) return { data: null, migrationPending: true };
  if (error) throw new Error(`Falha ao ler o contrato: ${error.message}`);
  if (!data) return { data: null, migrationPending: false };

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select(CONTRACT_CLUB_COLUMNS)
    .eq("id", data.club_id)
    .maybeSingle();
  if (clubError) throw new Error(`Falha ao ler o clube do contrato: ${clubError.message}`);

  return { data: { contract: data, club: club ?? null }, migrationPending: false };
}

/** Linha da trilha de auditoria, no formato que a tela de trilha consome. */
export interface ContractAuditRow {
  id: string;
  occurred_at: string;
  actor_email: string;
  action: string;
  target_club_id: string | null;
  target_club_name: string | null;
  details: unknown;
  ip: string | null;
}

/**
 * Trilha das ações contract.* de um clube, mais novas primeiro. A tabela de
 * auditoria (0072) pode não existir: devolve `migrationPending`, e a tela diz
 * isso em vez de cair.
 */
export async function listContractAuditTrail(
  clubId: string,
  limit = 30,
): Promise<ContractsResult<ContractAuditRow[]>> {
  if (!isUuid(clubId)) return { data: [], migrationPending: false };

  const { data, error } = await createAdminClient()
    .from("platform_audit_log")
    .select("id, occurred_at, actor_email, action, target_club_id, target_club_name, details, ip")
    .eq("target_club_id", clubId)
    .like("action", `${escapeLike("contract")}.%`)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (isMissingRelation(error)) return { data: [], migrationPending: true };
  if (error) throw new Error(`Falha ao ler a trilha de auditoria: ${error.message}`);
  return { data: (data ?? []) as ContractAuditRow[], migrationPending: false };
}
