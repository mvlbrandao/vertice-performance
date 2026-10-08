import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings, type PlatformSettings } from "@/lib/platform/license";

/**
 * Colunas de `clubs` que as telas de administração leem. Literal (e não
 * string solta) para o supabase-js inferir o tipo da linha a partir dela.
 */
const CLUB_ADMIN_COLUMNS =
  "id, name, slug, status, trial_ends_at, courtesy_until, courtesy_reason, max_athletes_override, price_cents_override, asaas_account_name, is_demo, created_at, owner_profile_id, billing_cpf_cnpj, asaas_customer_id, asaas_subscription_id, asaas_checkout_url, converted_at, payment_promise_used_at" as const;

const PAGE = 1000;

/** Atletas ativos por clube. */
async function countActiveAthletesByClub(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, number>> {
  const porClube = new Map<string, number>();

  // Uma consulta para todos os clubes (uma por clube viraria dezenas de idas
  // ao banco), mas em páginas: o PostgREST corta a resposta em 1000 linhas
  // sem avisar, e a contagem de um clube grande ficaria silenciosamente
  // menor que a real — justo o número que decide se ele estourou a cota.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("athletes")
      .select("club_id")
      .eq("is_active", true)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao contar atletas por clube: ${error.message}`);

    for (const row of data ?? []) {
      porClube.set(row.club_id, (porClube.get(row.club_id) ?? 0) + 1);
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  return porClube;
}

export async function loadClubsForAdmin() {
  const settings: PlatformSettings = await getPlatformSettings();
  const admin = createAdminClient();

  const [{ data: clubs, error }, atletasPorClube] = await Promise.all([
    admin.from("clubs").select(CLUB_ADMIN_COLUMNS).order("created_at", { ascending: false }),
    countActiveAthletesByClub(admin),
  ]);
  // Erro não pode virar lista vazia: a tela diria "nenhum clube" com a base
  // cheia, e a pessoa tomaria decisão em cima disso.
  if (error) throw new Error(`Falha ao ler os clubes: ${error.message}`);

  return { settings, clubs: clubs ?? [], atletasPorClube };
}

export type AdminClub = Awaited<ReturnType<typeof loadClubsForAdmin>>["clubs"][number];
