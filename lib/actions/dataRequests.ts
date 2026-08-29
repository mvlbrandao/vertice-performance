"use server";

import { revalidatePath } from "next/cache";
import { requireAthlete, requireCoach } from "@/lib/auth/guards";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAthleteExport, anonymizeAthleteData } from "@/lib/lgpd/athleteDataOps";
import { logAudit } from "@/lib/actions/auditLog";
import type { ActionResult } from "@/lib/actions/athletes";

export async function submitDataRequest(
  requestType: "export" | "deletion",
): Promise<ActionResult> {
  const athlete = await requireAthlete();
  if (!athlete.athleteId) return { error: "Conta não vinculada a um atleta." };

  const supabase = await createClient();
  const { error } = await supabase.from("data_requests").insert({
    athlete_id: athlete.athleteId,
    club_id: athlete.clubId,
    requested_by: athlete.userId,
    request_type: requestType,
  });

  if (error) return { error: error.message };
  revalidatePath("/privacidade");
  return { success: true };
}

/**
 * Executa de verdade a solicitação — nunca automático, sempre a partir de
 * um clique explícito do treinador (a confirmação humana que a decisão de
 * produto exige, sobretudo pra exclusão, que é irreversível).
 */
export async function processDataRequest(requestId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("data_requests")
    .select("id, athlete_id, request_type, status")
    .eq("id", requestId)
    .eq("club_id", coach.clubId)
    .single();
  if (requestError || !request) return { error: "Solicitação não encontrada." };
  if (request.status !== "Pendente") return { error: "Essa solicitação já foi processada." };

  const admin = createAdminClient();

  try {
    if (request.request_type === "export") {
      const dump = await buildAthleteExport(admin, request.athlete_id);
      const path = `${coach.clubId}/${request.athlete_id}/${request.id}.json`;
      const { error: uploadError } = await admin.storage
        .from("data-exports")
        .upload(path, JSON.stringify(dump, null, 2), {
          contentType: "application/json",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      await supabase
        .from("data_requests")
        .update({
          status: "Concluído",
          resolved_at: new Date().toISOString(),
          resolved_by: coach.userId,
          export_path: path,
        })
        .eq("id", requestId);

      await logAudit({
        clubId: coach.clubId,
        entityType: "athlete",
        entityId: request.athlete_id,
        action: "export",
        details: { request_id: request.id },
        performedBy: coach.userId,
        performedByName: coach.fullName,
        athleteId: request.athlete_id,
      });
    } else {
      await anonymizeAthleteData(admin, request.athlete_id, coach.clubId);

      await supabase
        .from("data_requests")
        .update({
          status: "Concluído",
          resolved_at: new Date().toISOString(),
          resolved_by: coach.userId,
        })
        .eq("id", requestId);

      await logAudit({
        clubId: coach.clubId,
        entityType: "athlete",
        entityId: request.athlete_id,
        action: "anonymize",
        details: { request_id: request.id },
        performedBy: coach.userId,
        performedByName: coach.fullName,
        athleteId: request.athlete_id,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao processar a solicitação.";
    await supabase
      .from("data_requests")
      .update({
        status: "Falhou",
        resolved_at: new Date().toISOString(),
        resolved_by: coach.userId,
        error_message: message,
      })
      .eq("id", requestId);
    return { error: message };
  }

  revalidatePath("/config");
  revalidatePath("/athletes");
  return { success: true };
}

/**
 * Link assinado pro export baixado — sempre gerado na hora, nunca cravado
 * na página, porque expira. Atleta só acessa o próprio; treinador acessa
 * qualquer um do clube.
 */
export async function getDataExportDownloadUrl(
  requestId: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { error: "Não autenticado." };

  const supabase = await createClient();
  // RLS ("athlete reads own data_requests" / "coach reads club data_requests")
  // já restringe às linhas visíveis — não sobra nada pra checar aqui.
  const { data: request } = await supabase
    .from("data_requests")
    .select("export_path, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.status !== "Concluído" || !request.export_path) {
    return { error: "Exportação não disponível." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("data-exports")
    .createSignedUrl(request.export_path, 3600);
  if (error || !data) return { error: "Não foi possível gerar o link de download." };
  return { url: data.signedUrl };
}
