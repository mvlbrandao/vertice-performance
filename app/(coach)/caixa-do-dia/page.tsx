import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CloseCashRegisterButton, ReopenCashRegisterButton } from "@/components/reports/CashRegisterActions";
import { NewCashMovementModal } from "@/components/reports/NewCashMovementModal";
import { DeleteCashMovementButton } from "@/components/reports/DeleteCashMovementButton";
import { hojeISO } from "@/lib/utils/date";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return hojeISO();
}
function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

type Movement = {
  type: "income" | "expense";
  time: string | null;
  label: string;
  cents: number;
  id?: string;
};

export default async function CaixaDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayISO();
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const dayEnd = `${date}T23:59:59`;

  const [{ data: charges }, { data: expenses }, { data: movementRows }, { data: closure }] =
    await Promise.all([
      supabase
        .from("athlete_charges")
        .select("amount_cents, discount_cents, paid_at, description, athletes(full_name)")
        .eq("club_id", profile!.clubId)
        .eq("status", "Pago")
        .gte("paid_at", date)
        .lte("paid_at", dayEnd),
      supabase
        .from("expenses")
        .select("amount_cents, paid_at, description, expense_categories(name)")
        .eq("club_id", profile!.clubId)
        .eq("status", "Pago")
        .gte("paid_at", date)
        .lte("paid_at", dayEnd),
      supabase
        .from("cash_movements")
        .select("id, type, description, amount_cents, created_at")
        .eq("club_id", profile!.clubId)
        .eq("movement_date", date),
      supabase
        .from("daily_cash_closures")
        .select("*")
        .eq("club_id", profile!.clubId)
        .eq("closure_date", date)
        .maybeSingle(),
    ]);

  const movements: Movement[] = [
    ...(charges ?? []).map((c) => ({
      type: "income" as const,
      time: c.paid_at,
      label: `${(c.athletes as unknown as { full_name: string } | null)?.full_name ?? "Atleta"} — ${c.description}`,
      cents: c.amount_cents - c.discount_cents,
    })),
    ...(expenses ?? []).map((e) => ({
      type: "expense" as const,
      time: e.paid_at,
      label: `${e.description}${
        (e.expense_categories as unknown as { name: string } | null)?.name
          ? ` (${(e.expense_categories as unknown as { name: string }).name})`
          : ""
      }`,
      cents: e.amount_cents,
    })),
    ...(movementRows ?? []).map((m) => ({
      type: m.type === "entrada" ? ("income" as const) : ("expense" as const),
      time: m.created_at,
      label: `${m.description} (avulso)`,
      cents: m.amount_cents,
      id: m.id,
    })),
  ].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  const incomeCents = movements
    .filter((m) => m.type === "income")
    .reduce((sum, m) => sum + m.cents, 0);
  const expenseCents = movements
    .filter((m) => m.type === "expense")
    .reduce((sum, m) => sum + m.cents, 0);
  const balanceCents = incomeCents - expenseCents;

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const outOfSync =
    closure &&
    (closure.income_cents !== incomeCents || closure.expense_cents !== expenseCents);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Caixa do dia</h1>
          <div className="text-xs text-ink-faint mt-0.5 capitalize">{dateLabel}</div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Link
            href={`/caixa-do-dia?date=${addDaysISO(date, -1)}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            ← Dia anterior
          </Link>
          <Link
            href={`/caixa-do-dia?date=${todayISO()}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            Hoje
          </Link>
          <Link
            href={`/caixa-do-dia?date=${addDaysISO(date, 1)}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            Dia seguinte →
          </Link>
          <NewCashMovementModal movementDate={date} />
        </div>
      </div>

      {closure ? (
        <Card className="mb-4 bg-[#F2F2F2]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Badge tone="dark">🔒 Caixa fechado</Badge>
                {outOfSync && (
                  <Badge tone="amber">⚠️ Novos lançamentos após o fechamento</Badge>
                )}
              </div>
              <span className="text-[12.5px] text-ink-soft">
                Fechado por {closure.closed_by_name} em{" "}
                {new Date(closure.closed_at).toLocaleString("pt-BR")}
                {closure.notes ? ` · ${closure.notes}` : ""}
              </span>
            </div>
            <ReopenCashRegisterButton closureDate={date} />
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[12.5px] text-ink-soft m-0">
              Confira os lançamentos do dia abaixo e feche o caixa quando terminar de lançar
              despesas, pagamentos e recebimentos.
            </p>
            <CloseCashRegisterButton closureDate={date} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Entradas</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(incomeCents)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Saídas</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(expenseCents)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Saldo do dia</span>
          <b
            className={`block font-display text-2xl leading-none mt-1 ${balanceCents < 0 ? "text-clay" : ""}`}
          >
            {formatCents(balanceCents)}
          </b>
        </Card>
      </div>

      <Card>
        {movements.length === 0 ? (
          <EmptyState icon="🗓️" message="Nenhum lançamento pago neste dia." />
        ) : (
          movements.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0"
            >
              <span className="font-mono text-[11px] text-ink-faint w-12 shrink-0">
                {m.time ? new Date(m.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
              <Badge tone={m.type === "income" ? "green" : "clay"}>
                {m.type === "income" ? "Entrada" : "Saída"}
              </Badge>
              <span className="flex-1 text-sm truncate">{m.label}</span>
              <b
                className={`font-mono text-sm ${m.type === "income" ? "text-[#1A6B3C]" : "text-clay"}`}
              >
                {m.type === "income" ? "+" : "−"} {formatCents(m.cents)}
              </b>
              {m.id && <DeleteCashMovementButton id={m.id} />}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
