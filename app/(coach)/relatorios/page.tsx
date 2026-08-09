import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  listFinancialTransactions,
  isAsaasFeeTransaction,
  AsaasError,
} from "@/lib/asaas/client";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatReais(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthBounds(monthParam?: string) {
  const now = new Date();
  const [year, month] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, year, month };
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const { start, end, year, month } = monthBounds(monthParam);

  const [{ data: charges }, { data: expenses }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select("amount_cents, discount_cents, paid_at")
      .eq("club_id", profile!.clubId)
      .eq("status", "Pago")
      .gte("paid_at", start)
      .lte("paid_at", `${end}T23:59:59`),
    supabase
      .from("expenses")
      .select("amount_cents, paid_at, expense_categories(name)")
      .eq("club_id", profile!.clubId)
      .eq("status", "Pago")
      .gte("paid_at", start)
      .lte("paid_at", `${end}T23:59:59`),
  ]);

  const revenueCents = (charges ?? []).reduce(
    (sum, c) => sum + (c.amount_cents - c.discount_cents),
    0,
  );
  const expenseCents = (expenses ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const balanceCents = revenueCents - expenseCents;

  const byCategory = new Map<string, number>();
  for (const e of expenses ?? []) {
    const name = (e.expense_categories as unknown as { name: string } | null)?.name ?? "Sem categoria";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount_cents);
  }

  let feeTransactions: { type: string; value: number; description: string }[] = [];
  let feesError: string | null = null;
  if (process.env.ASAAS_API_KEY) {
    try {
      const all = await listFinancialTransactions(start, end);
      feeTransactions = all.filter((t) => isAsaasFeeTransaction(t.type));
    } catch (e) {
      feesError = e instanceof AsaasError ? e.message : "Não foi possível buscar as taxas no Asaas.";
    }
  }
  const feesTotal = feeTransactions.reduce((sum, t) => sum + Math.abs(t.value), 0);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);
  const toParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Relatórios financeiros</h1>
          <div className="text-xs text-ink-faint mt-0.5 capitalize">{monthLabel}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/relatorios?month=${toParam(prevMonth)}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            ← Mês anterior
          </Link>
          <Link
            href={`/relatorios?month=${toParam(nextMonth)}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            Mês seguinte →
          </Link>
        </div>
      </div>

      <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">
        Relatório de caixa
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Recebimentos</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(revenueCents)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Despesas pagas</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(expenseCents)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Saldo do mês</span>
          <b
            className={`block font-display text-2xl leading-none mt-1 ${balanceCents < 0 ? "text-clay" : ""}`}
          >
            {formatCents(balanceCents)}
          </b>
        </Card>
      </div>

      <Card className="mb-5">
        <h3 className="mt-0 mb-3 text-sm">Despesas por categoria</h3>
        {byCategory.size === 0 ? (
          <EmptyState icon="💸" message="Nenhuma despesa paga neste mês." />
        ) : (
          Array.from(byCategory.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, cents]) => (
              <div
                key={name}
                className="flex items-center justify-between py-2 border-b border-line last:border-b-0 text-sm"
              >
                <span>{name}</span>
                <b className="font-mono">{formatCents(cents)}</b>
              </div>
            ))
        )}
      </Card>

      <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">
        Taxas do Asaas
      </div>
      <Card>
        {!process.env.ASAAS_API_KEY ? (
          <EmptyState icon="💳" message="Integração Asaas não configurada." />
        ) : feesError ? (
          <div className="bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px]">
            {feesError}
          </div>
        ) : feeTransactions.length === 0 ? (
          <EmptyState icon="💳" message="Nenhuma taxa cobrada neste mês." />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-ink-soft">Total de taxas</span>
              <b className="font-mono text-lg">{formatReais(feesTotal)}</b>
            </div>
            {feeTransactions.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-line last:border-b-0 text-sm gap-2"
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{t.description}</span>
                  <Badge tone="dark">{t.type}</Badge>
                </div>
                <b className="font-mono shrink-0">{formatReais(Math.abs(t.value))}</b>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
