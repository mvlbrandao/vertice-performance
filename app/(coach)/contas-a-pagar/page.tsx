import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewExpenseModal } from "@/components/expenses/NewExpenseModal";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { cn } from "@/lib/utils/cn";
import { hojeISO } from "@/lib/utils/date";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return hojeISO();
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "aberto", label: "Em aberto" },
  { value: "atrasado", label: "Atrasado" },
  { value: "pago", label: "Pago" },
];

function buildHref(params: {
  status: string;
  categoryId: string;
  professionalId: string;
  sort: string;
  overrides?: Partial<Record<"status" | "categoryId" | "professionalId" | "sort", string>>;
}) {
  const merged = { ...params, ...params.overrides };
  const qs = new URLSearchParams();
  if (merged.status !== "all") qs.set("status", merged.status);
  if (merged.categoryId) qs.set("categoryId", merged.categoryId);
  if (merged.professionalId) qs.set("professionalId", merged.professionalId);
  if (merged.sort !== "due_asc") qs.set("sort", merged.sort);
  const query = qs.toString();
  return query ? `/contas-a-pagar?${query}` : "/contas-a-pagar";
}

export default async function ContasAPagarPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    professionalId?: string;
    sort?: string;
  }>;
}) {
  const {
    status: statusFilter = "all",
    categoryId: categoryFilter = "",
    professionalId: professionalFilter = "",
    sort = "due_asc",
  } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);

  const [{ data: expenses }, { data: categories }, { data: professionals }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, description, amount_cents, due_date, status, category_id, professional_id, notes, expense_categories(name), profiles!professional_id(full_name)",
      )
      .eq("club_id", profile!.clubId)
      .neq("status", "Cancelado"),
    supabase
      .from("expense_categories")
      .select("id, name, requires_professional")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .eq("role", "staff")
      .order("full_name", { ascending: true }),
  ]);

  const categoryOptions = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    requiresProfessional: c.requires_professional,
  }));

  const isOverdue = (e: { status: string; due_date: string }) =>
    e.status === "Atrasado" || (e.status === "Pendente" && e.due_date < today);

  const scoped = (expenses ?? []).filter((e) => {
    if (categoryFilter && e.category_id !== categoryFilter) return false;
    if (professionalFilter && e.professional_id !== professionalFilter) return false;
    return true;
  });

  const openTotal = scoped
    .filter((e) => e.status === "Pendente" || e.status === "Atrasado")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const overdueTotal = scoped.filter(isOverdue).reduce((sum, e) => sum + e.amount_cents, 0);
  const paidThisMonthTotal = scoped
    .filter((e) => e.status === "Pago" && e.due_date.slice(0, 7) === monthPrefix)
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const dueThisMonth = scoped.filter((e) => e.due_date.slice(0, 7) === monthPrefix);
  const dueThisMonthTotal = dueThisMonth.reduce((sum, e) => sum + e.amount_cents, 0);
  const overdueThisMonthTotal = dueThisMonth.filter(isOverdue).reduce((sum, e) => sum + e.amount_cents, 0);
  const overduePct =
    dueThisMonthTotal > 0 ? Math.round((overdueThisMonthTotal / dueThisMonthTotal) * 100) : 0;

  const rows = scoped
    .filter((e) => {
      if (statusFilter === "aberto") return e.status === "Pendente" || e.status === "Atrasado";
      if (statusFilter === "atrasado") return isOverdue(e);
      if (statusFilter === "pago") return e.status === "Pago";
      return true;
    })
    .sort((a, b) =>
      sort === "due_desc" ? b.due_date.localeCompare(a.due_date) : a.due_date.localeCompare(b.due_date),
    );

  const linkParams = {
    status: statusFilter,
    categoryId: categoryFilter,
    professionalId: professionalFilter,
    sort,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Contas a pagar</h1>
          <div className="text-xs text-ink-faint mt-0.5">
            Despesas do clube, por categoria — aluguel, material, salários etc.
          </div>
        </div>
        <NewExpenseModal categories={categoryOptions} professionals={professionals ?? []} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
          <span className="text-xs font-semibold text-ink-soft">Atraso do mês</span>
          <b className="block font-display text-2xl leading-none mt-1 text-clay">{overduePct}%</b>
          <span className="text-[11px] text-ink-faint mt-1 block">
            do que venceu neste mês segue em aberto
          </span>
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
        <form action="/contas-a-pagar" method="get" className="flex gap-2 flex-wrap items-center">
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
          <select
            name="categoryId"
            defaultValue={categoryFilter}
            className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="professionalId"
            defaultValue={professionalFilter}
            className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
          >
            <option value="">Todos os profissionais</option>
            {(professionals ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
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
          {(categoryFilter || professionalFilter) && (
            <Link
              href={buildHref({ ...linkParams, overrides: { categoryId: "", professionalId: "" } })}
              className="text-xs font-semibold text-ink-faint hover:underline"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="💸" message="Nenhuma despesa encontrada." />
        ) : (
          rows.map((e) => (
            <ExpenseRow
              key={e.id}
              id={e.id}
              description={e.description}
              categoryId={e.category_id}
              categoryName={
                (e.expense_categories as unknown as { name: string } | null)?.name ?? null
              }
              categories={categoryOptions}
              professionalId={e.professional_id}
              professionalName={
                (e.profiles as unknown as { full_name: string } | null)?.full_name ?? null
              }
              professionals={professionals ?? []}
              amountCents={e.amount_cents}
              notes={e.notes}
              dueDate={e.due_date}
              status={e.status}
            />
          ))
        )}
      </Card>
    </div>
  );
}
