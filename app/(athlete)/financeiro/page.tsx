import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestCancellationButton } from "@/components/athletes/RequestCancellationButton";
import type { ChargeStatus } from "@/lib/types/database";

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const STATUS_TONE: Record<ChargeStatus, "green" | "amber" | "clay" | "dark"> = {
  Pago: "green",
  Pendente: "amber",
  Atrasado: "clay",
  Cancelado: "dark",
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AthleteFinanceiroPage() {
  const profile = await getSessionProfile();

  if (!profile?.athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();
  const [{ data: charges }, { data: pendingCancellation }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select("*")
      .eq("athlete_id", profile.athleteId)
      .neq("status", "Cancelado")
      .order("due_date", { ascending: false }),
    supabase
      .from("athlete_cancellation_requests")
      .select("reason_category, requested_at")
      .eq("athlete_id", profile.athleteId)
      .eq("status", "Pendente")
      .maybeSingle(),
  ]);

  return (
    <div>
      <h2 className="text-[28px] mb-6">Financeiro</h2>
      <Card>
        {!charges || charges.length === 0 ? (
          <EmptyState icon="💳" message="Nenhum lançamento registrado ainda." />
        ) : (
          charges.map((c) => (
            <div
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 border-b border-line last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <b className="text-sm block">{c.description}</b>
                <span className="text-xs text-ink-faint">
                  {MONTHS[c.competence_month - 1]}/{c.competence_year} · vence {c.due_date}
                </span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap shrink-0">
                <span className="font-mono text-sm font-semibold text-right">
                  {c.discount_cents > 0 ? (
                    <span className="block">
                      <span className="text-ink-faint line-through text-xs block">
                        {formatCents(c.amount_cents)}
                      </span>
                      {formatCents(c.amount_cents - c.discount_cents)}
                    </span>
                  ) : (
                    formatCents(c.amount_cents)
                  )}
                </span>
                <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="mt-0 mb-3">Contrato</h3>
        <RequestCancellationButton
          pendingRequest={
            pendingCancellation
              ? {
                  reasonCategory: pendingCancellation.reason_category,
                  requestedAt: pendingCancellation.requested_at,
                }
              : null
          }
        />
      </Card>
    </div>
  );
}
