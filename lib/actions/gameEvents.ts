"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const EVENT_TYPES = [
  "Gol",
  "Assistência",
  "Falta",
  "Cartão amarelo",
  "Cartão vermelho",
  "Lesão",
  "Pênalti sofrido",
  "Pênalti perdido",
  "Pênalti defendido",
] as const;
const GOAL_TYPES = ["Normal", "Pênalti", "Cabeça", "Contra", "Fora da área"] as const;

const eventSchema = z.object({
  gameId: z.string().uuid(),
  athleteId: z.string().uuid(),
  eventType: z.enum(EVENT_TYPES),
  goalType: z.enum(GOAL_TYPES).optional().or(z.literal("")),
  minute: z.string().optional(),
  notes: z.string().trim().optional(),
});

export async function createGameEvent(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = eventSchema.safeParse({
    gameId: formData.get("gameId"),
    athleteId: formData.get("athleteId"),
    eventType: formData.get("eventType"),
    goalType: formData.get("goalType") ?? "",
    minute: formData.get("minute") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("game_events").insert({
    club_id: coach.clubId,
    game_id: parsed.data.gameId,
    athlete_id: parsed.data.athleteId,
    event_type: parsed.data.eventType,
    goal_type: parsed.data.eventType === "Gol" ? parsed.data.goalType || "Normal" : null,
    minute: parsed.data.minute ? Number(parsed.data.minute) : null,
    notes: parsed.data.notes || null,
    created_by: coach.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jogos/${parsed.data.gameId}`);
  return { success: true };
}

export async function deleteGameEvent(eventId: string, gameId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_events")
    .delete()
    .eq("id", eventId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath(`/jogos/${gameId}`);
  return { success: true };
}

export async function updateGameScore(
  gameId: string,
  ourScore: number | null,
  opponentScore: number | null,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ our_score: ourScore, opponent_score: opponentScore })
    .eq("id", gameId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath(`/jogos/${gameId}`);
  revalidatePath("/jogos");
  return { success: true };
}
