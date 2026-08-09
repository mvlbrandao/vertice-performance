"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const competitionSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da competição."),
});

export async function createCompetition(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = competitionSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("competitions").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
  });
  if (error) return { error: error.message };

  revalidatePath("/jogos");
  return { success: true };
}

export async function deleteCompetition(competitionId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", competitionId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/jogos");
  return { success: true };
}

const gameSchema = z.object({
  competitionId: z.string().uuid(),
  opponent: z.string().trim().min(1, "Informe o adversário."),
  scheduledDate: z.string().min(1, "Informe a data."),
  scheduledTime: z.string().optional(),
  location: z.string().trim().optional(),
  targetType: z.enum(["athlete", "team"]),
  targetAthleteId: z.string().uuid().optional().or(z.literal("")),
  targetTeam: z.string().trim().optional().or(z.literal("")),
  targetCategory: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export async function createGame(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = gameSchema.safeParse({
    competitionId: formData.get("competitionId"),
    opponent: formData.get("opponent"),
    scheduledDate: formData.get("scheduledDate"),
    scheduledTime: formData.get("scheduledTime"),
    location: formData.get("location"),
    targetType: formData.get("targetType"),
    targetAthleteId: formData.get("targetAthleteId") ?? "",
    targetTeam: formData.get("targetTeam") ?? "",
    targetCategory: formData.get("targetCategory") ?? "",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.targetType === "athlete" && !parsed.data.targetAthleteId) {
    return { error: "Selecione o atleta alvo do jogo." };
  }
  if (parsed.data.targetType === "team" && !parsed.data.targetTeam) {
    return { error: "Selecione o time alvo do jogo." };
  }
  if (parsed.data.targetType === "team" && !parsed.data.targetCategory) {
    return { error: "Selecione o sub (categoria) do jogo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("games").insert({
    club_id: coach.clubId,
    competition_id: parsed.data.competitionId,
    created_by: coach.userId,
    opponent: parsed.data.opponent,
    scheduled_date: parsed.data.scheduledDate,
    scheduled_time: parsed.data.scheduledTime || null,
    location: parsed.data.location || null,
    target_type: parsed.data.targetType,
    target_athlete_id: parsed.data.targetType === "athlete" ? parsed.data.targetAthleteId : null,
    target_team: parsed.data.targetType === "team" ? parsed.data.targetTeam : null,
    target_category: parsed.data.targetType === "team" ? parsed.data.targetCategory : null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/jogos");
  return { success: true };
}

export async function deleteGame(gameId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/jogos");
  return { success: true };
}

function lineupPaths(gameId: string) {
  revalidatePath(`/jogos/${gameId}`);
  revalidatePath(`/jogos/${gameId}/escalacao`);
  revalidatePath("/minha-agenda");
  revalidatePath("/perfil");
}

export async function setLineupStatus(
  gameId: string,
  athleteId: string,
  status: "Titular" | "Reserva" | "Convocado" | null,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();

  if (status === null) {
    const { error } = await supabase
      .from("game_lineups")
      .delete()
      .eq("club_id", coach.clubId)
      .eq("game_id", gameId)
      .eq("athlete_id", athleteId);
    if (error) return { error: error.message };
    lineupPaths(gameId);
    return { success: true };
  }

  const { error } = await supabase.from("game_lineups").upsert(
    { club_id: coach.clubId, game_id: gameId, athlete_id: athleteId, status },
    { onConflict: "game_id,athlete_id" },
  );
  if (error) return { error: error.message };

  lineupPaths(gameId);
  return { success: true };
}

export async function setLineupNotes(
  gameId: string,
  athleteId: string,
  notes: string,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_lineups")
    .update({ notes: notes || null })
    .eq("club_id", coach.clubId)
    .eq("game_id", gameId)
    .eq("athlete_id", athleteId);
  if (error) return { error: error.message };

  lineupPaths(gameId);
  return { success: true };
}

const lineupMaterialSchema = z.object({
  gameId: z.string().uuid(),
  playId: z.string().uuid().optional().or(z.literal("")),
  videoUrl: z.string().trim().url("Link de vídeo inválido.").optional().or(z.literal("")),
});

export async function updateLineupMaterial(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = lineupMaterialSchema.safeParse({
    gameId: formData.get("gameId"),
    playId: formData.get("playId") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({
      lineup_play_id: parsed.data.playId || null,
      lineup_video_url: parsed.data.videoUrl || null,
    })
    .eq("id", parsed.data.gameId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  lineupPaths(parsed.data.gameId);
  return { success: true };
}

export async function publishLineup(gameId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ lineup_published_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  lineupPaths(gameId);
  return { success: true };
}

export async function unpublishLineup(gameId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ lineup_published_at: null })
    .eq("id", gameId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  lineupPaths(gameId);
  return { success: true };
}
