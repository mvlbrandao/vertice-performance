import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingCancellationCard } from "@/components/athletes/PendingCancellationCard";

const STATUS_TONE: Record<string, "green" | "amber" | "clay"> = {
  Aprovado: "clay",
  Pendente: "amber",
  Rejeitado: "green",
};

export default async function CancelamentosPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("athlete_cancellation_requests")
    .select("*, athletes(full_name)")
    .eq("club_id", profile!.clubId)
    .order("requested_at", { ascending: false });

  const rows = requests ?? [];
  const pending = rows.filter((r) => r.status === "Pendente");
  const decided = rows.filter((r) => r.status !== "Pendente");

  const approvedByReason = new Map<string, number>();
  for (const r of rows.filter((r) => r.status === "Aprovado")) {
    approvedByReason.set(r.reason_category, (approvedByReason.get(r.reason_category) ?? 0) + 1);
  }
  const totalApproved = rows.filter((r) => r.status === "Aprovado").length;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[28px] m-0">Cancelamentos</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Solicitações de cancelamento de contrato, motivos e histórico pra análise de churn.
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm mb-2">Pendentes de confirmação</h3>
          {pending.map((r) => (
            <PendingCancellationCard
              key={r.id}
              requestId={r.id}
              reasonCategory={`${(r.athletes as unknown as { full_name: string } | null)?.full_name ?? "Atleta"} — ${r.reason_category}`}
              reasonDetail={r.reason_detail}
              requestedAt={r.requested_at}
            />
          ))}
        </div>
      )}

      <h3 className="text-sm mb-2">Motivos (cancelamentos aprovados)</h3>
      <Card className="mb-5">
        {totalApproved === 0 ? (
          <EmptyState icon="📊" message="Nenhum cancelamento aprovado ainda." />
        ) : (
          Array.from(approvedByReason.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => (
              <div
                key={reason}
                className="flex items-center justify-between py-2 border-b border-line last:border-b-0 text-sm"
              >
                <span>{reason}</span>
                <b className="font-mono">
                  {count} ({Math.round((count / totalApproved) * 100)}%)
                </b>
              </div>
            ))
        )}
      </Card>

      <h3 className="text-sm mb-2">Histórico</h3>
      <Card>
        {decided.length === 0 ? (
          <EmptyState icon="🗂️" message="Nenhum cancelamento avaliado ainda." />
        ) : (
          decided.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap"
            >
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <Badge tone="dark">{r.reason_category}</Badge>
                  {r.requested_by_role === "athlete" && <Badge tone="sky">solicitado pelo atleta</Badge>}
                </div>
                <b className="text-sm block">
                  {(r.athletes as unknown as { full_name: string } | null)?.full_name ?? "Atleta"}
                </b>
                {r.reason_detail && (
                  <span className="text-xs text-ink-soft block">{r.reason_detail}</span>
                )}
                {r.review_notes && (
                  <span className="text-xs text-ink-faint block mt-0.5">
                    Observação: {r.review_notes}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0 text-[11px] text-ink-faint">
                <span className="block">
                  solicitado {new Date(r.requested_at).toLocaleDateString("pt-BR")}
                </span>
                {r.reviewed_at && (
                  <span className="block">
                    avaliado {new Date(r.reviewed_at).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
