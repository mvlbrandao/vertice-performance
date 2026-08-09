import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ACTION_LABEL: Record<string, string> = {
  status_change: "Mudança de status",
  due_date_change: "Alteração de vencimento",
  edit: "Edição",
  delete: "Exclusão",
};

function describeDetails(action: string, details: Record<string, unknown>): string {
  if (action === "status_change") {
    return `${details.from ?? "—"} → ${details.to ?? "—"}`;
  }
  if (action === "due_date_change") {
    return `${details.from ?? "—"} → ${details.to ?? "—"}`;
  }
  if (action === "edit") {
    const from = details.from as Record<string, unknown> | null;
    const to = details.to as Record<string, unknown> | null;
    if (!from || !to) return "—";
    const parts: string[] = [];
    if (from.description !== to.description) {
      parts.push(`descrição: "${from.description}" → "${to.description}"`);
    }
    if (from.amount_cents !== to.amount_cents) {
      parts.push(
        `valor: ${formatCents(Number(from.amount_cents))} → ${formatCents(Number(to.amount_cents))}`,
      );
    }
    return parts.length > 0 ? parts.join(" · ") : "sem alterações de conteúdo";
  }
  return "—";
}

export default async function AuditoriaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("financial_audit_log")
    .select("*")
    .eq("club_id", profile!.clubId)
    .order("performed_at", { ascending: false })
    .limit(200);

  const chargeIds = (logs ?? []).filter((l) => l.entity_type === "charge").map((l) => l.entity_id);
  const expenseIds = (logs ?? [])
    .filter((l) => l.entity_type === "expense")
    .map((l) => l.entity_id);

  const [{ data: charges }, { data: expenses }] = await Promise.all([
    chargeIds.length > 0
      ? supabase
          .from("athlete_charges")
          .select("id, description, athletes(full_name)")
          .in("id", chargeIds)
      : Promise.resolve({ data: [] as { id: string; description: string; athletes: unknown }[] }),
    expenseIds.length > 0
      ? supabase.from("expenses").select("id, description").in("id", expenseIds)
      : Promise.resolve({ data: [] as { id: string; description: string }[] }),
  ]);

  const chargeById = new Map((charges ?? []).map((c) => [c.id, c]));
  const expenseById = new Map((expenses ?? []).map((e) => [e.id, e]));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[28px] m-0">Auditoria financeira</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Histórico de alterações, mudanças de status e baixas em contas a pagar e a receber.
        </div>
      </div>

      <Card>
        {!logs || logs.length === 0 ? (
          <EmptyState icon="🕵️" message="Nenhum registro de auditoria ainda." />
        ) : (
          logs.map((log) => {
            const isCharge = log.entity_type === "charge";
            const charge = isCharge ? chargeById.get(log.entity_id) : null;
            const expense = !isCharge ? expenseById.get(log.entity_id) : null;
            const athleteName = charge
              ? (charge.athletes as unknown as { full_name: string } | null)?.full_name
              : null;
            const label = isCharge
              ? `${athleteName ?? "Atleta"} — ${charge?.description ?? "lançamento removido"}`
              : (expense?.description ?? "despesa removida");

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap"
              >
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Badge tone={isCharge ? "sky" : "amber"}>
                      {isCharge ? "Contas a receber" : "Contas a pagar"}
                    </Badge>
                    <Badge tone="dark">{ACTION_LABEL[log.action] ?? log.action}</Badge>
                  </div>
                  <b className="text-sm block">{label}</b>
                  <span className="text-xs text-ink-soft">
                    {describeDetails(log.action, log.details as Record<string, unknown>)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold block">{log.performed_by_name}</span>
                  <span className="text-[11px] text-ink-faint font-mono">
                    {new Date(log.performed_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
