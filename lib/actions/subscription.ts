"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCoachIgnoringLicense } from "@/lib/auth/guards";
import { getClubLicense } from "@/lib/platform/license";
import type { ActionResult } from "@/lib/actions/athletes";

const HORAS_DE_PROMESSA = 48;

/**
 * Liberação única e automática: o dono promete pagar e o clube volta a
 * funcionar por 48h, sem precisar esperar o suporte responder. Só existe uma
 * vez por clube — o registro em payment_promise_used_at impede um segundo
 * uso, senão a promessa vira uma forma de nunca pagar.
 */
export async function promisePayment(): Promise<ActionResult> {
  const coach = await requireCoachIgnoringLicense();
  const admin = createAdminClient();

  const { data: club, error: readError } = await admin
    .from("clubs")
    .select("status, payment_promise_used_at")
    .eq("id", coach.clubId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!club) return { error: "Clube não encontrado." };

  if (club.payment_promise_used_at) {
    return { error: "Essa liberação já foi usada antes. Fale com o suporte para regularizar." };
  }
  if (club.status === "cancelado") {
    return { error: "A assinatura foi cancelada. Fale com o suporte para reativar." };
  }

  const license = await getClubLicense(coach.clubId);
  if (license.allowed) {
    return { error: "O acesso do clube já está liberado." };
  }

  const agora = new Date();
  const ate = new Date(agora.getTime() + HORAS_DE_PROMESSA * 60 * 60 * 1000);

  const { error } = await admin
    .from("clubs")
    .update({
      courtesy_until: ate.toISOString(),
      courtesy_reason: "Promessa de pagamento (liberação automática, uso único)",
      payment_promise_used_at: agora.toISOString(),
    })
    .eq("id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/assinatura");
  return { success: true };
}
