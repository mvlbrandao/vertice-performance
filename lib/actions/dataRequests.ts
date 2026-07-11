"use server";

import { revalidatePath } from "next/cache";
import { requireAthlete, requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
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

export async function resolveDataRequest(requestId: string): Promise<ActionResult> {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("data_requests")
    .update({ status: "Concluído", resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };
  revalidatePath("/config");
  return { success: true };
}
