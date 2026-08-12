import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverdueRow } from "@/components/billing/OverdueRow";
import { AGING_BUCKETS, getOverdueByAthlete } from "@/lib/billing/overdue";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function InadimplenciaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [overdue, { data: club }] = await Promise.all([
    getOverdueByAthlete(supabase, profile!.clubId, today),
    supabase.from("clubs").select("name").eq("id", profile!.clubId).single(),
  ]);

  const total = overdue.reduce((sum, a) => sum + a.totalCents, 0);
  const byBucket = AGING_BUCKETS.map((b) => ({
    ...b,
    athletes: overdue.filter((a) => a.bucket === b.key),
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">Financeiro</div>
        <h1 className="text-[28px] m-0">Régua de inadimplência</h1>
        <p className="text-sm text-ink-faint mt-1 max-w-[62ch]">
          Quem está devendo, há quanto tempo, e a cobrança pronta pra enviar. Quanto mais tempo
          passa, menor a chance de receber — por isso a lista começa por quem está atrasado há mais
          tempo.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Card>
          <span className="text-[12.5px] text-ink-faint block mb-1">Total em atraso</span>
          <b className="font-mono text-[22px] text-clay">{formatCents(total)}</b>
        </Card>
        {byBucket.map((b) => (
          <Card key={b.key}>
            <span className="text-[12.5px] text-ink-faint block mb-1">{b.label}</span>
            <b className="font-mono text-[22px]">{b.athletes.length}</b>
            <span className="text-[11.5px] text-ink-faint block mt-0.5">
              {formatCents(b.athletes.reduce((s, a) => s + a.totalCents, 0))}
            </span>
          </Card>
        ))}
      </div>

      {overdue.length === 0 ? (
        <Card>
          <EmptyState icon="🎉" message="Ninguém em atraso. Financeiro em dia!" />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {byBucket
            .filter((b) => b.athletes.length > 0)
            .map((b) => (
              <div key={b.key}>
                <h3 className="text-sm font-bold m-0 mb-2.5">
                  {b.label}{" "}
                  <span className="text-ink-faint font-normal">
                    · {b.athletes.length} {b.athletes.length === 1 ? "atleta" : "atletas"}
                  </span>
                </h3>
                <div className="flex flex-col gap-2">
                  {b.athletes.map((a) => (
                    <OverdueRow key={a.athleteId} athlete={a} clubName={club?.name ?? "Vértice"} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
