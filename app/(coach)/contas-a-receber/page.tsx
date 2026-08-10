import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChargeRow } from "@/components/billing/ChargeRow";
import { cn } from "@/lib/utils/cn";
import type { ChargeStatus } from "@/lib/types/database";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "aberto", label: "Em aberto" },
  { value: "atrasado", label: "Atrasado" },
  { value: "pago", label: "Pago" },
];

function buildHref(params: {
  status: string;
  team: string;
  athleteId: string;
  sort: string;
  overrides?: Partial<Record<"status" | "team" | "athleteId" | "sort", string>>;
}) {
  const merged = { ...params, ...params.overrides };
  const qs = new URLSearchParams();
  if (merged.status !== "all") qs.set("status", merged.status);
  if (merged.team) qs.set("team", merged.team);
  if (merged.athleteId) qs.set("athleteId", merged.athleteId);
  if (merged.sort !== "due_asc") qs.set("sort", merged.sort);
  const query = qs.toString();
  return query ? `/contas-a-receber?${query}` : "/contas-a-receber";
}

export default async function ContasAReceberPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; team?: string; athleteId?: string; sort?: string }>;
}) {
  const {
    status: statusFilter = "all",
    team: teamFilter = "",
    athleteId: athleteFilter = "",
    sort = "due_asc",
  } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);
  const monthStart = `${monthPrefix}-01`;

  const [{ data: charges }, { data: athletes }, { count: activeCount }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select(
        "id, description, amount_cents, discount_cents, competence_month, competence_year, due_date, status, athlete_id, athletes(full_name, team, guardian_name, asaas_customer_id)",
      )
      .eq("club_id", profile!.clubId)
      .neq("status", "Cancelado"),
    supabase
      .from("athletes")
      .select("id, full_name, team")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .eq("club_id", profile!.clubId)
      .eq("is_active", true),
  ]);

  const { count: churnCount } = await supabase
    .from("athletes")
    .select("*", { count: "exact", head: true })
    .eq("club_id", profile!.clubId)
    .eq("is_active", false)
    .gte("deactivated_at", monthStart);
  const churnCountValue = churnCount ?? 0;
  const rosterAtMonthStart = (activeCount ?? 0) + churnCountValue;
  const churnPct =
    rosterAtMonthStart > 0 ? Math.round((churnCountValue / rosterAtMonthStart) * 100) : 0;

  const teams = Array.from(new Set((athletes ?? []).map((a) => a.team).filter(Boolean))).sort() as string[];

  const netOf = (c: { amount_cents: number; discount_cents: number }) =>
    c.amount_cents - c.discount_cents;
  const isOverdue = (c: { status: ChargeStatus; due_date: string }) =>
    c.status === "Atrasado" || (c.status === "Pendente" && c.due_date < today);

  const scoped = (charges ?? []).filter((c) => {
    const a = c.athletes as unknown as { team: string | null } | null;
    if (teamFilter && a?.team !== teamFilter) return false;
    if (athleteFilter && c.athlete_id !== athleteFilter) return false;
    return true;
  });

  const openTotal = scoped
    .filter((c) => c.status === "Pendente" || c.status === "Atrasado")
    .reduce((sum, c) => sum + netOf(c), 0);
  const overdueTotal = scoped.filter(isOverdue).reduce((sum, c) => sum + netOf(c), 0);
  const paidThisMonthTotal = scoped
    .filter((c) => c.status === "Pago" && c.due_date.slice(0, 7) === monthPrefix)
    .reduce((sum, c) => sum + netOf(c), 0);

  const dueThisMonth = scoped.filter((c) => c.due_date.slice(0, 7) === monthPrefix);
  const dueThisMonthTotal = dueThisMonth.reduce((sum, c) => sum + netOf(c), 0);
  const overdueThisMonthTotal = dueThisMonth.filter(isOverdue).reduce((sum, c) => sum + netOf(c), 0);
  const inadimplenciaPct =
    dueThisMonthTotal > 0 ? Math.round((overdueThisMonthTotal / dueThisMonthTotal) * 100) : 0;

  const filtered = scoped
    .filter((c) => {
      if (statusFilter === "aberto") return c.status === "Pendente" || c.status === "Atrasado";
      if (statusFilter === "atrasado") return isOverdue(c);
      if (statusFilter === "pago") return c.status === "Pago";
      return true;
    })
    .sort((a, b) => (sort === "due_desc" ? b.due_date.localeCompare(a.due_date) : a.due_date.localeCompare(b.due_date)));

  const linkParams = { status: statusFilter, team: teamFilter, athleteId: athleteFilter, sort };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Contas a receber</h1>
          <div className="text-xs text-ink-faint mt-0.5">
            Recebimentos de mensalidade de todos os atletas.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Em aberto</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(openTotal)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Atrasado</span>
          <b className="block font-display text-2xl leading-none mt-1 text-clay">
            {formatCents(overdueTotal)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Pago este mês</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(paidThisMonthTotal)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Inadimplência do mês</span>
          <b className="block font-display text-2xl leading-none mt-1 text-clay">
            {inadimplenciaPct}%
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Churn de contratos</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {churnCountValue} <span className="text-base font-semibold">({churnPct}%)</span>
          </b>
        </Card>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildHref({ ...linkParams, overrides: { status: f.value } })}
            className={cn(
              "text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark",
              statusFilter === f.value && "bg-pitch-dark text-white border-pitch-dark",
            )}
          >
            {f.label}
          </Link>
        ))}
        <div className="w-px h-5 bg-line mx-1" />
        <form action="/contas-a-receber" method="get" className="flex gap-2 flex-wrap items-center">
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
          <select
            name="team"
            defaultValue={teamFilter}
            className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
          >
            <option value="">Todos os clubes</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            name="athleteId"
            defaultValue={athleteFilter}
            className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
          >
            <option value="">Todos os atletas</option>
            {(athletes ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
          >
            <option value="due_asc">Vencimento (mais próximo primeiro)</option>
            <option value="due_desc">Vencimento (mais distante primeiro)</option>
          </select>
          <button
            type="submit"
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            Aplicar
          </button>
          {(teamFilter || athleteFilter) && (
            <Link
              href={buildHref({ ...linkParams, overrides: { team: "", athleteId: "" } })}
              className="text-xs font-semibold text-ink-faint hover:underline"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="💳" message="Nenhum lançamento encontrado." />
        ) : (
          filtered.map((c) => {
            const a = c.athletes as unknown as {
              full_name: string;
              guardian_name: string | null;
              asaas_customer_id: string | null;
            } | null;
            return (
              <div key={c.id}>
                <div className="flex items-center gap-1.5 flex-wrap pt-2.5 first:pt-0">
                  {a?.guardian_name && (
                    <span className="text-[11px] text-ink-faint">
                      Responsável: <b className="text-ink-soft">{a.guardian_name}</b>
                    </span>
                  )}
                  {a?.asaas_customer_id && (
                    <Link
                      href={`/athletes/${c.athlete_id}/financeiro`}
                      className="text-[11px] text-pitch-dark hover:underline"
                      title="Ver régua de cobrança configurada no Asaas"
                    >
                      📣 régua Asaas
                    </Link>
                  )}
                </div>
                <ChargeRow
                  id={c.id}
                  athleteId={c.athlete_id}
                  athleteName={a?.full_name ?? "Atleta"}
                  description={c.description}
                  amountCents={c.amount_cents}
                  discountCents={c.discount_cents}
                  competenceMonth={c.competence_month}
                  competenceYear={c.competence_year}
                  dueDate={c.due_date}
                  status={c.status}
                  canManage
                />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
