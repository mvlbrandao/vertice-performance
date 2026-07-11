"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const checkinSchema = z.object({
  fatigue: z.coerce.number().min(1).max(5),
  pain: z.string().trim().optional(),
  trainingDone: z.coerce.boolean(),
  dietDone: z.coerce.boolean(),
});

export async function submitCheckin(formData: FormData): Promise<ActionResult> {
  const athlete = await requireAthlete();
  if (!athlete.athleteId) return { error: "Conta não vinculada a um atleta." };

  const parsed = checkinSchema.safeParse({
    fatigue: formData.get("fatigue"),
    pain: formData.get("pain"),
    trainingDone: formData.get("trainingDone") === "true",
    dietDone: formData.get("dietDone") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("checkins").upsert(
    {
      athlete_id: athlete.athleteId,
      club_id: athlete.clubId,
      fatigue_level: parsed.data.fatigue,
      pain_notes: parsed.data.pain || "Nenhuma",
      training_done: parsed.data.trainingDone,
      diet_done: parsed.data.dietDone,
      checkin_date: today,
    },
    { onConflict: "athlete_id,checkin_date" },
  );

  if (error) return { error: error.message };
  revalidatePath("/checkin");
  return { success: true };
}
