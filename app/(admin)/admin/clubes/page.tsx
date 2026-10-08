import { requirePlatformAdmin } from "@/lib/platform/admin";
import { isAuditTrailAvailable } from "@/lib/platform/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClubsForAdmin } from "@/lib/platform/clubsOverview";
import { getPlatformBillingOverview } from "@/lib/platform/billingOverview";
import { filterClubs, parseClubFilters } from "@/lib/platform/clubFilters";
import { ClubAdminRow } from "@/components/platform/ClubAdminRow";
import { ClubFiltersForm } from "@/components/admin/ClubFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MigrationNotice } from "@/components/admin/MigrationNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { hojeISO, somaDias } from "@/lib/utils/date";

type Search = Promise<{ q?: string | string[]; status?: string | string[] }>;

export default async function AdminClubesPage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();

  const filters = parseClubFilters(await searchParams);
  const { settings, clubs, atletasPorClube } = await loadClubsForAdmin();

  const today = hojeISO();
  const [billingOverview, auditAvailable] = await Promise.all([
    getPlatformBillingOverview(createAdminClient(), today, somaDias(today, 7), `${today.slice(0, 7)}-01`),
    isAuditTrailAvailable(),
  ]);

  const visiveis = filterClubs(clubs, filters);
  const filtrando = filters.q !== "" || filters.status !== "todos";

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title="Clubes"
        description={
          filtrando
            ? `${visiveis.length} de ${clubs.length} clubes`
            : `${clubs.length} ${clubs.length === 1 ? "clube" : "clubes"} na plataforma`
        }
      />

      {!auditAvailable && (
        <div className="mb-3">
          <MigrationNotice
            migration="0072"
            what="A trilha de auditoria ainda não existe no banco, então o que for alterado nos clubes NÃO fica registrado."
          />
        </div>
      )}

      <ClubFiltersForm filters={filters} />

      {visiveis.length === 0 ? (
        <EmptyState
          icon="🏟️"
          message={filtrando ? "Nenhum clube com esses filtros." : "Nenhum clube cadastrado ainda."}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visiveis.map((club) => (
            <ClubAdminRow
              key={club.id}
              club={club}
              atletasAtivos={atletasPorClube.get(club.id) ?? 0}
              cotaPadrao={settings.maxAthletes}
              precoPadraoCents={settings.priceCents}
              overdue={billingOverview.overdueByClub.get(club.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
