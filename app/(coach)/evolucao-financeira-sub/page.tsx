import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthKey(iso: string) {
  return iso.slice(0, 7);
}
function yearMonthKeys(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export default async function EvolucaoFinanceiraSubPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();

  const months = yearMonthKeys(year);
  const windowStart = `${months[0]}-01`;
  const windowEnd = `${year}-12-31T23:59:59`;

  const [{ data: paidCharges }, { data: dueCharges }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select("amount_cents, discount_cents, paid_at, athletes(category)")
      .eq("club_id", profile!.clubId)
      .eq("status", "Pago")
      .gte("paid_at", windowStart)
      .lte("paid_at", windowEnd),
    supabase
      .from("athlete_charges")
      .select("amount_cents, discount_cents, due_date, status, athletes(category)")
      .eq("club_id", profile!.clubId)
      .neq("status", "Cancelado")
      .gte("due_date", windowStart)
      .lte("due_date", `${year}-12-31`),
  ]);

  const subOf = (row: { athletes: unknown }) =>
    (row.athletes as unknown as { category: string | null } | null)?.category ?? "Sem sub";

  // Receita líquida por sub/mês (pago)
  const revenueBySub = new Map<string, Map<string, number>>();
  for (const c of paidCharges ?? []) {
    if (!c.paid_at) continue;
    const key = monthKey(c.paid_at);
    if (!months.includes(key)) continue;
    const sub = subOf(c);
    const monthMap = revenueBySub.get(sub) ?? new Map<string, number>();
    monthMap.set(key, (monthMap.get(key) ?? 0) + (c.amount_cents - c.discount_cents));
    revenueBySub.set(sub, monthMap);
  }

  // Inadimplência por sub/mês: de tudo que venceu naquele mês, quanto está
  // atrasado hoje (cohort por mês de vencimento, não de pagamento).
  const dueBySubMonth = new Map<string, Map<string, number>>();
  const overdueBySubMonth = new Map<string, Map<string, number>>();
  const isOverdue = (c: { status: string; due_date: string }) =>
    c.status === "Atrasado" || (c.status === "Pendente" && c.due_date < today);
  for (const c of dueCharges ?? []) {
    const key = monthKey(c.due_date);
    if (!months.includes(key)) continue;
    const sub = subOf(c);
    const net = c.amount_cents - c.discount_cents;
    const dueMap = dueBySubMonth.get(sub) ?? new Map<string, number>();
    dueMap.set(key, (dueMap.get(key) ?? 0) + net);
    dueBySubMonth.set(sub, dueMap);
    if (isOverdue(c)) {
      const overdueMap = overdueBySubMonth.get(sub) ?? new Map<string, number>();
      overdueMap.set(key, (overdueMap.get(key) ?? 0) + net);
      overdueBySubMonth.set(sub, overdueMap);
    }
  }

  const allSubs = Array.from(
    new Set([...revenueBySub.keys(), ...dueBySubMonth.keys()]),
  ).sort();

  const revenueRows = allSubs.map((sub) => {
    const monthMap = revenueBySub.get(sub) ?? new Map<string, number>();
    const total = Array.from(monthMap.values()).reduce((a, b) => a + b, 0);
    return { sub, monthMap, total };
  });
  const revenueMonthTotals = months.map((m) =>
    revenueRows.reduce((sum, r) => sum + (r.monthMap.get(m) ?? 0), 0),
  );

  const overdueRows = allSubs.map((sub) => {
    const dueMap = dueBySubMonth.get(sub) ?? new Map<string, number>();
    const overdueMap = overdueBySubMonth.get(sub) ?? new Map<string, number>();
    const totalDue = Array.from(dueMap.values()).reduce((a, b) => a + b, 0);
    const totalOverdue = Array.from(overdueMap.values()).reduce((a, b) => a + b, 0);
    const pct = totalDue > 0 ? Math.round((totalOverdue / totalDue) * 100) : 0;
    return { sub, dueMap, overdueMap, totalDue, totalOverdue, pct };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Evolução de receita</h1>
          <div className="text-xs text-ink-faint mt-0.5">
            Recebimentos e inadimplência agrupados por categoria (SUB10, SUB11...) nos 12 meses de{" "}
            {year}.
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/evolucao-financeira-sub?year=${year - 1}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            ← {year - 1}
          </Link>
          <Link
            href={`/evolucao-financeira-sub?year=${year + 1}`}
            className="text-xs font-semibold border border-line rounded-sm px-3 py-2 hover:border-pitch-dark"
          >
            {year + 1} →
          </Link>
        </div>
      </div>

      <h3 className="text-sm mb-2">Recebimentos por sub</h3>
      <Card className="mb-5">
        {revenueRows.length === 0 ? (
          <EmptyState icon="💰" message="Nenhum recebimento no período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2 pr-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Sub
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="text-right py-2 px-2 font-semibold text-ink-soft text-xs uppercase tracking-wide capitalize"
                    >
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.map((r) => (
                  <tr key={r.sub} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pr-3 font-semibold">{r.sub}</td>
                    {months.map((m) => (
                      <td key={m} className="text-right py-2.5 px-2 font-mono text-[12.5px]">
                        {r.monthMap.get(m) ? formatCents(r.monthMap.get(m)!) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2.5 pl-3 font-mono font-semibold">
                      {formatCents(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line">
                  <td className="py-2.5 pr-3 font-bold">Total geral</td>
                  {revenueMonthTotals.map((cents, i) => (
                    <td key={months[i]} className="text-right py-2.5 px-2 font-mono font-bold text-[12.5px]">
                      {cents ? formatCents(cents) : "—"}
                    </td>
                  ))}
                  <td className="text-right py-2.5 pl-3 font-mono font-bold">
                    {formatCents(revenueMonthTotals.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <h3 className="text-sm mb-2">Inadimplência por sub</h3>
      <div className="text-[11.5px] text-ink-faint mb-2 -mt-1.5">
        % do valor que venceu em cada mês e continua em atraso hoje (por sub).
      </div>
      <Card>
        {overdueRows.length === 0 ? (
          <EmptyState icon="⚠️" message="Nenhum lançamento no período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2 pr-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Sub
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="text-right py-2 px-2 font-semibold text-ink-soft text-xs uppercase tracking-wide capitalize"
                    >
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {overdueRows.map((r) => (
                  <tr key={r.sub} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pr-3 font-semibold">{r.sub}</td>
                    {months.map((m) => {
                      const due = r.dueMap.get(m) ?? 0;
                      const overdue = r.overdueMap.get(m) ?? 0;
                      const pct = due > 0 ? Math.round((overdue / due) * 100) : null;
                      return (
                        <td
                          key={m}
                          className={`text-right py-2.5 px-2 font-mono text-[12.5px] ${pct !== null && pct >= 30 ? "text-clay font-semibold" : ""}`}
                        >
                          {pct !== null ? `${pct}%` : "—"}
                        </td>
                      );
                    })}
                    <td
                      className={`text-right py-2.5 pl-3 font-mono font-semibold ${r.pct >= 30 ? "text-clay" : ""}`}
                    >
                      {r.totalDue > 0 ? `${r.pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
