"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach, requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AsaasError, cancelSubscription } from "@/lib/asaas/client";
import { logAudit } from "@/lib/actions/auditLog";
import { CANCELLATION_REASONS } from "@/lib/data/cancellationReasons";
import type { ActionResult } from "@/lib/actions/athletes";
import { sendPushToAthlete } from "@/lib/push/send";
import { sendCancellationReviewedEmail } from "@/lib/email/send";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Cancela a assinatura recorrente no Asaas (se houver) e, se pedido,
 * cancela também as parcelas futuras em aberto. Não interrompe o fluxo
 * se o Asaas falhar — a desativação local do atleta segue adiante de
 * qualquer forma, e a assinatura fica marcada como cancelada aqui.
 */
async function cancelAthleteBilling(
  supabase: Supabase,
  params: {
    clubId: string;
    athleteId: string;
    cancelFutureCharges: boolean;
    performedBy: string;
    performedByName: string;
  },
) {
  const { data: subs } = await supabase
    .from("athlete_billing_subscriptions")
    .select("id, asaas_subscription_id")
    .eq("athlete_id", params.athleteId)
    .eq("status", "ACTIVE");

  for (const sub of subs ?? []) {
    try {
      await cancelSubscription(sub.asaas_subscription_id);
    } catch (e) {
      if (!(e instanceof AsaasError && e.status === 404)) {
        // Segue mesmo se o Asaas falhar — a assinatura é marcada
        // inativa localmente de qualquer forma; sem retry automático.
      }
    }
    await supabase.from("athlete_billing_subscriptions").update({ status: "INACTIVE" }).eq("id", sub.id);
  }

  if (params.cancelFutureCharges) {
    const { data: pendingCharges } = await supabase
      .from("athlete_charges")
      .select("id")
      .eq("athlete_id", params.athleteId)
      .in("status", ["Pendente", "Atrasado"]);

    for (const c of pendingCharges ?? []) {
      await supabase.from("athlete_charges").update({ status: "Cancelado" }).eq("id", c.id);
      await logAudit({
        clubId: params.clubId,
        entityType: "charge",
        entityId: c.id,
        action: "status_change",
        details: { from: "Pendente/Atrasado", to: "Cancelado", reason: "Cancelamento de contrato" },
        performedBy: params.performedBy,
        performedByName: params.performedByName,
      });
    }
  }
}

function invalidateAthletePaths(athleteId: string) {
  revalidatePath(`/athletes/${athleteId}/dados`);
  revalidatePath(`/athletes/${athleteId}/financeiro`);
  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/contas-a-receber");
  revalidatePath("/cancelamentos");
  revalidatePath("/perfil");
}

const deactivateSchema = z.object({
  athleteId: z.string().uuid(),
  reasonCategory: z.enum(CANCELLATION_REASONS),
  reasonDetail: z.string().trim().optional(),
  cancelFutureCharges: z.string().optional(),
});

/** Desativação direta pelo treinador (sem passar por solicitação do atleta). */
export async function deactivateAthlete(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = deactivateSchema.safeParse({
    athleteId: formData.get("athleteId"),
    reasonCategory: formData.get("reasonCategory"),
    reasonDetail: formData.get("reasonDetail") ?? "",
    cancelFutureCharges: formData.get("cancelFutureCharges") ?? "",
  });
  if (!parsed.success) {
    return { error: "Selecione um motivo válido." };
  }

  const supabase = await createClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", parsed.data.athleteId)
    .eq("club_id", coach.clubId)
    .single();
  if (!athlete) return { error: "Atleta não encontrado." };

  const cancelFutureCharges = parsed.data.cancelFutureCharges === "on";

  await cancelAthleteBilling(supabase, {
    clubId: coach.clubId,
    athleteId: parsed.data.athleteId,
    cancelFutureCharges,
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

  const reason = `${parsed.data.reasonCategory}${parsed.data.reasonDetail ? ` — ${parsed.data.reasonDetail}` : ""}`;
  const { error } = await supabase
    .from("athletes")
    .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: reason })
    .eq("id", parsed.data.athleteId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await supabase.from("athlete_cancellation_requests").insert({
    club_id: coach.clubId,
    athlete_id: parsed.data.athleteId,
    reason_category: parsed.data.reasonCategory,
    reason_detail: parsed.data.reasonDetail || null,
    status: "Aprovado",
    cancel_future_charges: cancelFutureCharges,
    requested_by: coach.userId,
    requested_by_role: "coach",
    reviewed_by: coach.userId,
    reviewed_at: new Date().toISOString(),
  });

  await logAudit({
    clubId: coach.clubId,
    entityType: "athlete",
    entityId: parsed.data.athleteId,
    action: "deactivate",
    details: { reason, cancel_future_charges: cancelFutureCharges },
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId: parsed.data.athleteId,
  });

  invalidateAthletePaths(parsed.data.athleteId);
  return { success: true };
}

export async function reactivateAthlete(athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({ is_active: true, deactivated_at: null, deactivation_reason: null })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "athlete",
    entityId: athleteId,
    action: "reactivate",
    details: {},
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId,
  });

  invalidateAthletePaths(athleteId);
  return { success: true };
}

const requestSchema = z.object({
  reasonCategory: z.enum(CANCELLATION_REASONS),
  reasonDetail: z.string().trim().optional(),
});

/** Solicitação de cancelamento pelo próprio atleta — não desativa nada sozinha. */
export async function requestCancellation(formData: FormData): Promise<ActionResult> {
  const profile = await requireAthlete();
  if (!profile.athleteId) return { error: "Perfil de atleta não encontrado." };

  const parsed = requestSchema.safeParse({
    reasonCategory: formData.get("reasonCategory"),
    reasonDetail: formData.get("reasonDetail") ?? "",
  });
  if (!parsed.success) {
    return { error: "Selecione um motivo válido." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("athlete_cancellation_requests")
    .select("id")
    .eq("athlete_id", profile.athleteId)
    .eq("status", "Pendente")
    .maybeSingle();
  if (existing) return { error: "Você já tem uma solicitação de cancelamento em análise." };

  const { error } = await supabase.from("athlete_cancellation_requests").insert({
    club_id: profile.clubId,
    athlete_id: profile.athleteId,
    reason_category: parsed.data.reasonCategory,
    reason_detail: parsed.data.reasonDetail || null,
    status: "Pendente",
    requested_by: profile.userId,
    requested_by_role: "athlete",
  });
  if (error) return { error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/cancelamentos");
  return { success: true };
}

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["Aprovado", "Rejeitado"]),
  reviewNotes: z.string().trim().optional(),
  cancelFutureCharges: z.string().optional(),
});

/** Treinador aprova ou rejeita uma solicitação de cancelamento feita pelo atleta. */
export async function reviewCancellationRequest(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    reviewNotes: formData.get("reviewNotes") ?? "",
    cancelFutureCharges: formData.get("cancelFutureCharges") ?? "",
  });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("athlete_cancellation_requests")
    .select("id, athlete_id, status")
    .eq("id", parsed.data.requestId)
    .eq("club_id", coach.clubId)
    .single();
  if (!request) return { error: "Solicitação não encontrada." };
  if (request.status !== "Pendente") return { error: "Essa solicitação já foi avaliada." };

  const cancelFutureCharges = parsed.data.cancelFutureCharges === "on";

  if (parsed.data.decision === "Aprovado") {
    await cancelAthleteBilling(supabase, {
      clubId: coach.clubId,
      athleteId: request.athlete_id,
      cancelFutureCharges,
      performedBy: coach.userId,
      performedByName: coach.fullName,
    });

    await supabase
      .from("athletes")
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: "Cancelamento solicitado pelo atleta, aprovado pelo treinador",
      })
      .eq("id", request.athlete_id)
      .eq("club_id", coach.clubId);
  }

  const { error } = await supabase
    .from("athlete_cancellation_requests")
    .update({
      status: parsed.data.decision,
      cancel_future_charges: cancelFutureCharges,
      reviewed_by: coach.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: parsed.data.reviewNotes || null,
    })
    .eq("id", parsed.data.requestId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await sendPushToAthlete(request.athlete_id, {
    title:
      parsed.data.decision === "Aprovado"
        ? "Cancelamento aprovado"
        : "Pedido de cancelamento avaliado",
    body:
      parsed.data.decision === "Aprovado"
        ? "Seu pedido de cancelamento de contrato foi aprovado pelo treinador."
        : "Seu pedido de cancelamento não foi aprovado — fale com o treinador.",
    url: "/perfil",
    tag: "cancellation-review",
  });

  const { data: athlete } = await supabase
    .from("athletes")
    .select("full_name, guardian_email")
    .eq("id", request.athlete_id)
    .single();
  if (athlete?.guardian_email) {
    await sendCancellationReviewedEmail({
      to: athlete.guardian_email,
      athleteName: athlete.full_name,
      approved: parsed.data.decision === "Aprovado",
    });
  }

  invalidateAthletePaths(request.athlete_id);
  return { success: true };
}
