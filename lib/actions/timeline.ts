"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const gameReportSchema = z.object({
  athleteId: z.string().uuid(),
  opponent: z.string().trim().min(1, "Informe o jogo/adversário."),
  strengths: z.string().trim().optional(),
  improve: z.string().trim().optional(),
});

export async function createGameReport(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = gameReportSchema.safeParse({
    athleteId: formData.get("athleteId"),
    opponent: formData.get("opponent"),
    strengths: formData.get("strengths"),
    improve: formData.get("improve"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("game_reports").insert({
    athlete_id: parsed.data.athleteId,
    club_id: coach.clubId,
    author_id: coach.userId,
    opponent: parsed.data.opponent,
    strengths: parsed.data.strengths || null,
    improve: parsed.data.improve || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/athletes/${parsed.data.athleteId}/evolucao`);
  return { success: true };
}

const mentalNoteSchema = z.object({
  athleteId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  body: z.string().trim().optional(),
  score: z.coerce.number().min(0).max(10).default(7),
  videoUrl: z.string().trim().optional(),
  entryDate: z.string().optional(),
});

export async function createMentalNote(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = mentalNoteSchema.safeParse({
    athleteId: formData.get("athleteId"),
    title: formData.get("title"),
    body: formData.get("body"),
    score: formData.get("score"),
    videoUrl: formData.get("videoUrl"),
    entryDate: formData.get("entryDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mental_notes").insert({
    athlete_id: parsed.data.athleteId,
    club_id: coach.clubId,
    author_id: coach.userId,
    title: parsed.data.title,
    body: parsed.data.body || "—",
    confidence_score: parsed.data.score,
    video_url: parsed.data.videoUrl || null,
    entry_date: parsed.data.entryDate || undefined,
  });

  if (error) return { error: error.message };
  revalidatePath(`/athletes/${parsed.data.athleteId}/evolucao`);
  return { success: true };
}
