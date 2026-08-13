import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { PlatformSettingsForm } from "@/components/platform/PlatformSettingsForm";
import { ClubAdminRow } from "@/components/platform/ClubAdminRow";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Painel da plataforma. Fora dos grupos (coach)/(athlete) de propósito: não
 * é uma tela de clube, e não deve passar pelos guards de clube nem herdar
 * o menu do treinador.
 */
export default async function PlataformaPage() {
  await requirePlatformAdmin();

  const settings = await getPlatformSettings();
  const admin = createAdminClient();

  const { data: clubs } = await admin
    .from("clubs")
    .select(
      "id, name, slug, status, trial_ends_at, courtesy_until, courtesy_reason, max_athletes_override, price_cents_override, asaas_account_name, is_demo, created_at",
    )
    .order("created_at", { ascending: false });

  // Uma consulta só pra contar atletas de todos os clubes: uma por clube
  // viraria dezenas de idas ao banco conforme a base cresce.
  const { data: athleteRows } = await admin
    .from("athletes")
    .select("club_id")
    .eq("is_active", true);

  const porClube = new Map<string, number>();
  for (const a of athleteRows ?? []) {
    porClube.set(a.club_id, (porClube.get(a.club_id) ?? 0) + 1);
  }

  const lista = clubs ?? [];
  const pagantes = lista.filter((c) => c.status === "ativo");
  const receita = pagantes.reduce(
    (sum, c) => sum + (c.price_cents_override ?? settings.priceCents),
    0,
  );

  return (
    <div className="p-5 sm:p-7 max-w-[1200px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[28px] m-0">Plataforma</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Clientes, licenças e configuração comercial do Vértice.
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Clubes" value={String(lista.length)} />
        <Kpi label="Pagantes" value={String(pagantes.length)} />
        <Kpi label="Em teste" value={String(lista.filter((c) => c.status === "trial").length)} />
        <Kpi label="Receita recorrente" value={formatCents(receita)} />
      </div>

      <PlatformSettingsForm settings={settings} />

      <h2 className="text-[19px] mt-6 mb-3">Clubes</h2>
      <div className="flex flex-col gap-2.5">
        {lista.map((club) => (
          <ClubAdminRow
            key={club.id}
            club={club}
            atletasAtivos={porClube.get(club.id) ?? 0}
            cotaPadrao={settings.maxAthletes}
            precoPadraoCents={settings.priceCents}
          />
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper border border-line rounded-md px-3.5 py-3">
      <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
        {label}
      </span>
      <b className="text-xl font-display">{value}</b>
    </div>
  );
}
