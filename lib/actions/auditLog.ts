import "server-only";
import { createClient } from "@/lib/supabase/server";

type Entity = "charge" | "expense" | "cash_closure";
type Action = "status_change" | "due_date_change" | "edit" | "delete" | "reopen";

export async function logFinancialAudit(params: {
  clubId: string;
  entityType: Entity;
  entityId: string;
  action: Action;
  details: Record<string, unknown>;
  performedBy: string;
  performedByName: string;
}) {
  const supabase = await createClient();
  await supabase.from("financial_audit_log").insert({
    club_id: params.clubId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    details: params.details,
    performed_by: params.performedBy,
    performed_by_name: params.performedByName,
  });
}
