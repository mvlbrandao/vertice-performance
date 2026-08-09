import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewExpenseModal } from "@/components/expenses/NewExpenseModal";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ContasAPagarPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, description, amount_cents, due_date, status, expense_categories(name)")
      .eq("club_id", profile!.clubId)
      .order("due_date", { ascending: true }),
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  const rows = expenses ?? [];
  const isOverdue = (e: { status: string; due_date: string }) =>
    e.status === "Atrasado" || (e.status === "Pendente" && e.due_date < today);
  const openTotal = rows
    .filter((e) => e.status === "Pendente" || e.status === "Atrasado")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const overdueTotal = rows.filter(isOverdue).reduce((sum, e) => sum + e.amount_cents, 0);
  const paidThisMonthTotal = rows
    .filter((e) => e.status === "Pago" && e.due_date.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, e) => sum + e.amount_cents, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Contas a pagar</h1>
          <div className="text-xs text-ink-faint mt-0.5">
            Despesas do clube, por categoria — aluguel, material, salários etc.
          </div>
        </div>
        <NewExpenseModal categories={categories ?? []} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
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
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="💸" message="Nenhuma despesa lançada ainda." />
        ) : (
          rows.map((e) => (
            <ExpenseRow
              key={e.id}
              id={e.id}
              description={e.description}
              categoryName={
                (e.expense_categories as unknown as { name: string } | null)?.name ?? null
              }
              amountCents={e.amount_cents}
              dueDate={e.due_date}
              status={e.status}
            />
          ))
        )}
      </Card>
    </div>
  );
}
