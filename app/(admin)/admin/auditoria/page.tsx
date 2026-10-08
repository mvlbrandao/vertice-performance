import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/platform/contracts";
import {
  AUDIT_PAGE_SIZE,
  auditHref,
  escapeLike,
  isExactAction,
  parseAuditFilters,
} from "@/lib/platform/auditQuery";
import { AuditTable, type AuditRowView } from "@/components/admin/AuditTable";
import { AuditFiltersForm } from "@/components/admin/AuditFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MigrationNotice } from "@/components/admin/MigrationNotice";

type Search = Promise<{
  acao?: string | string[];
  clube?: string | string[];
  antes?: string | string[];
}>;

export default async function AdminAuditoriaPage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();

  const filters = parseAuditFilters(await searchParams);
  const admin = createAdminClient();

  // Desempata por id: duas linhas no mesmo instante não podem trocar de
  // lugar entre uma consulta e outra.
  let query = admin
    .from("platform_audit_log")
    .select("id, occurred_at, actor_email, action, target_club_id, target_club_name, details, ip")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    // Uma a mais que a página, só para saber se existe próxima.
    .limit(AUDIT_PAGE_SIZE + 1);

  if (filters.before) query = query.lt("occurred_at", filters.before);
  if (filters.clubId) query = query.eq("target_club_id", filters.clubId);
  if (filters.action) {
    query = isExactAction(filters.action)
      ? query.eq("action", filters.action)
      : query.like("action", `${escapeLike(filters.action)}.%`);
  }

  const [{ data, error }, { data: clubs }] = await Promise.all([
    query,
    admin.from("clubs").select("id, name").order("name"),
  ]);

  const header = (
    <AdminPageHeader
      title="Auditoria"
      description="Quem mexeu em quê na plataforma, e quando. Horários de Brasília. A trilha só recebe registros: nada é editado nem apagado."
    />
  );

  if (isMissingRelation(error)) {
    return (
      <div className="max-w-[1200px] mx-auto">
        {header}
        <MigrationNotice
          migration="0072"
          what="A trilha de auditoria ainda não existe no banco, então as ações do painel não estão sendo registradas."
        />
      </div>
    );
  }
  if (error) throw new Error(`Falha ao ler a trilha de auditoria: ${error.message}`);

  const all = (data ?? []) as AuditRowView[];
  const rows = all.slice(0, AUDIT_PAGE_SIZE);
  const nextCursor = all.length > AUDIT_PAGE_SIZE ? rows[rows.length - 1].occurred_at : null;

  return (
    <div className="max-w-[1200px] mx-auto">
      {header}

      <AuditFiltersForm filters={filters} clubs={clubs ?? []} />
      <AuditTable rows={rows} />

      <div className="flex items-center justify-between gap-3 mt-4 text-[13px]">
        {filters.before ? (
          <Link
            href={auditHref({ ...filters, before: null })}
            className="font-semibold underline text-ink-soft"
          >
            ← Voltar às mais recentes
          </Link>
        ) : (
          <span />
        )}
        {nextCursor ? (
          <Link
            href={auditHref({ ...filters, before: nextCursor })}
            className="font-semibold underline"
          >
            Mais antigas →
          </Link>
        ) : (
          rows.length > 0 && <span className="text-ink-faint">Fim da trilha</span>
        )}
      </div>
    </div>
  );
}
