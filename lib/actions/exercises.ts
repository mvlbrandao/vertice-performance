"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach, requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const exerciseSchema = z.object({
  athleteId: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome do exercício."),
  description: z.string().trim().optional(),
  focus: z.string().trim().optional(),
  scheduledDate: z.string().optional(),
  videoUrl: z.string().trim().optional(),
});

export async function createExercise(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = exerciseSchema.safeParse({
    athleteId: formData.get("athleteId"),
    name: formData.get("name"),
    description: formData.get("description"),
    focus: formData.get("focus"),
    scheduledDate: formData.get("scheduledDate"),
    videoUrl: formData.get("videoUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").insert({
    athlete_id: parsed.data.athleteId,
    club_id: coach.clubId,
    prescribed_by: coach.userId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    focus: parsed.data.focus || null,
    scheduled_date: parsed.data.scheduledDate || undefined,
    video_url: parsed.data.videoUrl || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/athletes/${parsed.data.athleteId}/treino`);
  return { success: true };
}

export async function toggleExerciseDone(exerciseId: string, athleteId: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("exercises").update({ done }).eq("id", exerciseId);
  revalidatePath(`/athletes/${athleteId}/treino`);
  revalidatePath("/treino");
}

export async function createExerciseVideoRecord(input: {
  exerciseId: string;
  label: string;
  storagePath: string;
}): Promise<ActionResult> {
  const athlete = await requireAthlete();
  if (!athlete.athleteId) return { error: "Conta não vinculada a um atleta." };

  const supabase = await createClient();
  const { error } = await supabase.from("exercise_videos").insert({
    exercise_id: input.exerciseId,
    athlete_id: athlete.athleteId,
    club_id: athlete.clubId,
    storage_path: input.storagePath,
    label: input.label,
  });

  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { success: true };
}

export async function reviewExerciseVideo(
  videoId: string,
  athleteId: string,
  comment: string,
) {
  const coach = await requireCoach();
  const supabase = await createClient();
  await supabase
    .from("exercise_videos")
    .update({
      status: "Avaliado",
      coach_comment: comment || null,
      reviewed_by: coach.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", videoId);
  revalidatePath(`/athletes/${athleteId}/treino`);
}
