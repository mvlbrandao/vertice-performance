import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const MONTHS_WINDOW = 6;

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function lastNMonthKeys(n: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export default async function EvolucaoDespesasPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const months = lastNMonthKeys(MONTHS_WINDOW);
  const windowStart = `${months[0]}-01`;

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount_cents, paid_at, expense_categories(name)")
    .eq("club_id", profile!.clubId)
    .eq("status", "Pago")
    .gte("paid_at", windowStart);

  // categoria -> mês -> total em centavos
  const byCategory = new Map<string, Map<string, number>>();
  for (const e of expenses ?? []) {
    if (!e.paid_at) continue;
    const key = monthKey(e.paid_at);
    if (!months.includes(key)) continue;
    const name =
      (e.expense_categories as unknown as { name: string } | null)?.name ?? "Sem categoria";
    const monthMap = byCategory.get(name) ?? new Map<string, number>();
    monthMap.set(key, (monthMap.get(key) ?? 0) + e.amount_cents);
    byCategory.set(name, monthMap);
  }

  const halfway = Math.floor(MONTHS_WINDOW / 2);
  const recentMonths = months.slice(-halfway);
  const priorMonths = months.slice(0, months.length - halfway);

  const rows = Array.from(byCategory.entries())
    .map(([name, monthMap]) => {
      const total = Array.from(monthMap.values()).reduce((a, b) => a + b, 0);
      const recentSum = recentMonths.reduce((sum, m) => sum + (monthMap.get(m) ?? 0), 0);
      const priorSum = priorMonths.reduce((sum, m) => sum + (monthMap.get(m) ?? 0), 0);
      const growthPct = priorSum > 0 ? Math.round(((recentSum - priorSum) / priorSum) * 100) : null;
      const isNew = priorSum === 0 && recentSum > 0;
      const isGrowing = growthPct !== null && growthPct >= 10;
      return { name, monthMap, total, growthPct, isNew, isGrowing };
    })
    .sort((a, b) => b.total - a.total);

  const monthTotals = months.map((m) =>
    Array.from(byCategory.values()).reduce((sum, monthMap) => sum + (monthMap.get(m) ?? 0), 0),
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[28px] m-0">Evolução de despesas</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Despesas pagas por categoria nos últimos {MONTHS_WINDOW} meses, sinalizando categorias
          em crescimento (últimos {halfway} meses vs. os {halfway} anteriores).
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="📊" message="Nenhuma despesa paga no período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2 pr-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Categoria
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
                  <th className="text-left py-2 pl-3 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                    Tendência
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pr-3 font-semibold">{r.name}</td>
                    {months.map((m) => (
                      <td key={m} className="text-right py-2.5 px-2 font-mono text-[12.5px]">
                        {r.monthMap.get(m) ? formatCents(r.monthMap.get(m)!) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2.5 pl-3 font-mono font-semibold">
                      {formatCents(r.total)}
                    </td>
                    <td className="py-2.5 pl-3">
                      {r.isGrowing && (
                        <Badge tone="clay">📈 Em crescimento ({r.growthPct! > 0 ? "+" : ""}{r.growthPct}%)</Badge>
                      )}
                      {!r.isGrowing && r.isNew && <Badge tone="sky">🆕 Nova</Badge>}
                      {!r.isGrowing && !r.isNew && r.growthPct !== null && r.growthPct <= -10 && (
                        <Badge tone="green">📉 Em queda ({r.growthPct}%)</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line">
                  <td className="py-2.5 pr-3 font-bold">Total geral</td>
                  {monthTotals.map((cents, i) => (
                    <td key={months[i]} className="text-right py-2.5 px-2 font-mono font-bold text-[12.5px]">
                      {cents ? formatCents(cents) : "—"}
                    </td>
                  ))}
                  <td className="text-right py-2.5 pl-3 font-mono font-bold">
                    {formatCents(monthTotals.reduce((a, b) => a + b, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
