"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import {
  INJURY_BODY_REGIONS,
  INJURY_TYPES,
  INJURY_SEVERITIES,
  INJURY_STATUSES,
} from "@/lib/data/injuries";

function paths(athleteId: string) {
  revalidatePath(`/athletes/${athleteId}/lesoes`);
  revalidatePath(`/athletes/${athleteId}/dados`);
}

const createSchema = z.object({
  athleteId: z.string().uuid(),
  source: z.enum(["Jogo", "Avulso"]),
  gameId: z.string().uuid().optional().or(z.literal("")),
  bodyRegion: z.enum(INJURY_BODY_REGIONS),
  injuryType: z.enum(INJURY_TYPES),
  severity: z.enum(INJURY_SEVERITIES),
  description: z.string().trim().optional(),
  occurredAt: z.string().min(1, "Informe a data."),
  expectedReturnDate: z.string().optional().or(z.literal("")),
  treatmentNotes: z.string().trim().optional(),
});

export async function createInjury(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = createSchema.safeParse({
    athleteId: formData.get("athleteId"),
    source: formData.get("source"),
    gameId: formData.get("gameId") ?? "",
    bodyRegion: formData.get("bodyRegion"),
    injuryType: formData.get("injuryType"),
    severity: formData.get("severity"),
    description: formData.get("description") ?? "",
    occurredAt: formData.get("occurredAt"),
    expectedReturnDate: formData.get("expectedReturnDate") ?? "",
    treatmentNotes: formData.get("treatmentNotes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.source === "Jogo" && !parsed.data.gameId) {
    return { error: "Selecione o jogo em que a lesão ocorreu." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("athlete_injuries").insert({
    club_id: coach.clubId,
    athlete_id: parsed.data.athleteId,
    source: parsed.data.source,
    game_id: parsed.data.source === "Jogo" ? parsed.data.gameId || null : null,
    body_region: parsed.data.bodyRegion,
    injury_type: parsed.data.injuryType,
    severity: parsed.data.severity,
    description: parsed.data.description || null,
    occurred_at: parsed.data.occurredAt,
    expected_return_date: parsed.data.expectedReturnDate || null,
    treatment_notes: parsed.data.treatmentNotes || null,
    created_by: coach.userId,
  });
  if (error) return { error: error.message };

  paths(parsed.data.athleteId);
  return { success: true };
}

const updateSchema = z.object({
  status: z.enum(INJURY_STATUSES),
  expectedReturnDate: z.string().optional().or(z.literal("")),
  treatmentNotes: z.string().trim().optional(),
});

export async function updateInjury(
  injuryId: string,
  athleteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = updateSchema.safeParse({
    status: formData.get("status"),
    expectedReturnDate: formData.get("expectedReturnDate") ?? "",
    treatmentNotes: formData.get("treatmentNotes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_injuries")
    .update({
      status: parsed.data.status,
      expected_return_date: parsed.data.expectedReturnDate || null,
      treatment_notes: parsed.data.treatmentNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", injuryId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}

export async function deleteInjury(injuryId: string, athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_injuries")
    .delete()
    .eq("id", injuryId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}
