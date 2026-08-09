"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import type { SwotCategory } from "@/lib/types/database";

function paths(athleteId: string) {
  revalidatePath(`/athletes/${athleteId}/anamnese`);
  revalidatePath("/anamnese");
}

export async function openSwotCycle(athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("athlete_swot_cycles")
    .select("cycle_number")
    .eq("athlete_id", athleteId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("athlete_swot_cycles").insert({
    club_id: coach.clubId,
    athlete_id: athleteId,
    cycle_number: (last?.cycle_number ?? 0) + 1,
    created_by: coach.userId,
  });
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}

export async function closeSwotCycle(cycleId: string, athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_swot_cycles")
    .update({ status: "Fechado", closed_at: new Date().toISOString() })
    .eq("id", cycleId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}

const swotItemSchema = z.object({
  cycleId: z.string().uuid(),
  athleteId: z.string().uuid(),
  category: z.enum(["Força", "Fraqueza", "Oportunidade", "Ameaça"]),
  description: z.string().trim().min(1, "Descreva o ponto."),
  targetMeetings: z.string().optional(),
  targetTrainings: z.string().optional(),
});

export async function createSwotItem(formData: FormData): Promise<ActionResult> {
  const profile = await getSessionProfile();
  if (!profile || (profile.role !== "coach" && profile.role !== "athlete")) {
    return { error: "Sem permissão." };
  }

  const parsed = swotItemSchema.safeParse({
    cycleId: formData.get("cycleId"),
    athleteId: formData.get("athleteId"),
    category: formData.get("category"),
    description: formData.get("description"),
    targetMeetings: formData.get("targetMeetings") ?? "",
    targetTrainings: formData.get("targetTrainings") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (profile.role === "athlete" && profile.athleteId !== parsed.data.athleteId) {
    return { error: "Você só pode registrar pontos na sua própria análise." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("athlete_swot_items").insert({
    cycle_id: parsed.data.cycleId,
    club_id: profile.clubId,
    athlete_id: parsed.data.athleteId,
    category: parsed.data.category as SwotCategory,
    author_role: profile.role,
    description: parsed.data.description,
    target_meetings: profile.role === "coach" ? Number(parsed.data.targetMeetings) || 0 : 0,
    target_trainings: profile.role === "coach" ? Number(parsed.data.targetTrainings) || 0 : 0,
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  paths(parsed.data.athleteId);
  return { success: true };
}

export async function updateSwotItemTargets(
  itemId: string,
  athleteId: string,
  targetMeetings: number,
  targetTrainings: number,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_swot_items")
    .update({ target_meetings: targetMeetings, target_trainings: targetTrainings })
    .eq("id", itemId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}

export async function setSwotItemStatus(
  itemId: string,
  athleteId: string,
  status: "Aberto" | "Concluído",
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_swot_items")
    .update({ status })
    .eq("id", itemId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}

export async function deleteSwotItem(itemId: string, athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_swot_items")
    .delete()
    .eq("id", itemId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}
