import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuditEntity =
  | "charge"
  | "expense"
  | "cash_closure"
  | "athlete"
  | "lineup"
  | "injury"
  | "access"
  | "challenge";

export type AuditAction =
  | "status_change"
  | "due_date_change"
  | "edit"
  | "delete"
  | "reopen"
  | "create"
  | "deactivate"
  | "reactivate"
  | "transfer"
  | "publish"
  | "unpublish"
  | "grant"
  | "revoke"
  | "review";

export async function logAudit(params: {
  clubId: string;
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  details: Record<string, unknown>;
  performedBy: string;
  performedByName: string;
  athleteId?: string | null;
  /**
   * Cliente alternativo pra quem registra sem sessão de treinador — o
   * resgate de convite, por exemplo, acontece antes de a pessoa ter
   * qualquer sessão, e a política de escrita exige um coach logado.
   */
  client?: SupabaseClient<never, never, never>;
}) {
  const supabase = params.client ?? (await createClient());
  await supabase.from("audit_log").insert({
    club_id: params.clubId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    details: params.details,
    performed_by: params.performedBy,
    performed_by_name: params.performedByName,
    athlete_id: params.athleteId ?? null,
  });
}

/**
 * Diferença entre dois retratos do mesmo registro, só com os campos que
 * mudaram. Guardar o objeto inteiro deixaria a trilha ilegível: o
 * treinador quer ver "posição: Ala → Fixo", não vinte campos idênticos.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      changes[key] = { from: from ?? null, to: to ?? null };
    }
  }
  return changes;
}
