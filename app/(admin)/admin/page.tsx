import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClubsForAdmin } from "@/lib/platform/clubsOverview";
import { computeOverviewMetrics } from "@/lib/platform/overviewMetrics";
import { buildLeadFunnel } from "@/lib/platform/leads";
import { getPlatformBillingOverview } from "@/lib/platform/billingOverview";
import { LeadFunnel } from "@/components/platform/LeadFunnel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Kpi } from "@/components/admin/Kpi";
import { hojeISO, somaDias } from "@/lib/utils/date";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();

  const { settings, clubs, atletasPorClube } = await loadClubsForAdmin();

  const today = hojeISO();
  const weekAhead = somaDias(today, 7);
  const monthStart = `${today.slice(0, 7)}-01`;

  const metrics = computeOverviewMetrics(clubs, settings.priceCents, today);
  const naoDemo = clubs.filter((c) => !c.is_demo);

  const [leads, billingOverview] = await Promise.all([
    buildLeadFunnel(naoDemo, atletasPorClube),
    getPlatformBillingOverview(createAdminClient(), today, weekAhead, monthStart),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title="Visão geral"
        description="Clientes, receita e funil comercial do Vértice."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi
          label="Clubes"
          value={String(metrics.clientes)}
          hint={metrics.demos > 0 ? `+ ${metrics.demos} de demonstração` : undefined}
        />
        <Kpi label="Pagantes" value={String(metrics.pagantes)} />
        <Kpi label="Em teste" value={String(metrics.emTeste)} />
        <Kpi label="Receita recorrente" value={formatCents(metrics.receitaRecorrenteCents)} />
      </div>

      <h2 className="text-[19px] mt-6 mb-3">Funil de leads</h2>
      <LeadFunnel
        leads={leads}
        recebidoMesCents={billingOverview.recebidoMesCents}
        aReceber7DiasCents={billingOverview.aReceber7DiasCents}
        conversoes30={metrics.conversoes30}
        cohort30={metrics.cohort30}
        conversoes90={metrics.conversoes90}
        cohort90={metrics.cohort90}
        tempoMedioConversaoDias={metrics.tempoMedioConversaoDias}
      />
    </div>
  );
}
