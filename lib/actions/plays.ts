"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import type { Json } from "@/lib/types/database";

const playSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da jogada."),
  targetType: z.enum(["athlete", "team"]),
  targetAthleteId: z.string().uuid().optional().or(z.literal("")),
  targetTeam: z.string().trim().optional().or(z.literal("")),
  videoUrl: z.string().trim().url("Link inválido.").optional().or(z.literal("")),
  description: z.string().trim().optional(),
  frames: z.string().min(1, "Jogada sem quadros."),
});

function parsePlayForm(formData: FormData) {
  const parsed = playSchema.safeParse({
    name: formData.get("name"),
    targetType: formData.get("targetType"),
    targetAthleteId: formData.get("targetAthleteId") ?? "",
    targetTeam: formData.get("targetTeam") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    description: formData.get("description") ?? "",
    frames: formData.get("frames"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." } as const;
  }
  if (parsed.data.targetType === "athlete" && !parsed.data.targetAthleteId) {
    return { error: "Selecione o atleta alvo da jogada." } as const;
  }
  if (parsed.data.targetType === "team" && !parsed.data.targetTeam) {
    return { error: "Selecione o time alvo da jogada." } as const;
  }
  let frames: Json;
  try {
    frames = JSON.parse(parsed.data.frames) as Json;
  } catch {
    return { error: "Não foi possível salvar os quadros da jogada." } as const;
  }
  return {
    data: {
      name: parsed.data.name,
      target_type: parsed.data.targetType,
      target_athlete_id: parsed.data.targetType === "athlete" ? parsed.data.targetAthleteId : null,
      target_team: parsed.data.targetType === "team" ? parsed.data.targetTeam : null,
      video_url: parsed.data.videoUrl || null,
      description: parsed.data.description || null,
      frames,
    },
  } as const;
}

export async function createPlay(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = parsePlayForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("plays").insert({
    club_id: coach.clubId,
    created_by: coach.userId,
    ...parsed.data,
  });
  if (error) return { error: error.message };

  revalidatePath("/plays");
  return { success: true };
}

export async function updatePlay(playId: string, formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = parsePlayForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plays")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", playId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plays");
  revalidatePath(`/plays/${playId}`);
  return { success: true };
}

export async function deletePlay(playId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plays")
    .delete()
    .eq("id", playId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plays");
  return { success: true };
}
