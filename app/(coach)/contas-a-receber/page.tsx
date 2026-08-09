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

export default async function ContasAReceberPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter = "all" } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();

  const { data: charges } = await supabase
    .from("athlete_charges")
    .select(
      "id, description, amount_cents, discount_cents, competence_month, competence_year, due_date, status, athlete_id, athletes(full_name)",
    )
    .eq("club_id", profile!.clubId)
    .neq("status", "Cancelado")
    .order("due_date", { ascending: true });

  const rows = charges ?? [];
  const netOf = (c: { amount_cents: number; discount_cents: number }) =>
    c.amount_cents - c.discount_cents;
  const isOverdue = (c: { status: ChargeStatus; due_date: string }) =>
    c.status === "Atrasado" || (c.status === "Pendente" && c.due_date < today);

  const openTotal = rows
    .filter((c) => c.status === "Pendente" || c.status === "Atrasado")
    .reduce((sum, c) => sum + netOf(c), 0);
  const overdueTotal = rows.filter(isOverdue).reduce((sum, c) => sum + netOf(c), 0);
  const paidThisMonthTotal = rows
    .filter((c) => c.status === "Pago" && c.due_date.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, c) => sum + netOf(c), 0);

  const filtered = rows.filter((c) => {
    if (statusFilter === "aberto") return c.status === "Pendente" || c.status === "Atrasado";
    if (statusFilter === "atrasado") return isOverdue(c);
    if (statusFilter === "pago") return c.status === "Pago";
    return true;
  });

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

      <div className="flex gap-2 mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/contas-a-receber" : `/contas-a-receber?status=${f.value}`}
            className={cn(
              "text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark",
              statusFilter === f.value && "bg-pitch-dark text-white border-pitch-dark",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="💳" message="Nenhum lançamento encontrado." />
        ) : (
          filtered.map((c) => (
            <ChargeRow
              key={c.id}
              id={c.id}
              athleteId={c.athlete_id}
              athleteName={
                (c.athletes as unknown as { full_name: string } | null)?.full_name ?? "Atleta"
              }
              description={c.description}
              amountCents={c.amount_cents}
              discountCents={c.discount_cents}
              competenceMonth={c.competence_month}
              competenceYear={c.competence_year}
              dueDate={c.due_date}
              status={c.status}
              canManage
            />
          ))
        )}
      </Card>
    </div>
  );
}
