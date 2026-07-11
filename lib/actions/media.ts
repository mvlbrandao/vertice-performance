"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const mediaSchema = z.object({
  athleteId: z.string().uuid(),
  label: z.string().trim().min(1, "Informe uma descrição."),
  mediaType: z.enum(["video", "image"]),
  storagePath: z.string().trim().min(1, "Anexe um arquivo."),
});

export async function createMediaItemRecord(input: {
  athleteId: string;
  label: string;
  mediaType: "video" | "image";
  storagePath: string;
}): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("media_items").insert({
    athlete_id: parsed.data.athleteId,
    club_id: coach.clubId,
    author_id: coach.userId,
    label: parsed.data.label,
    media_type: parsed.data.mediaType,
    storage_path: parsed.data.storagePath,
    thumbnail_color: parsed.data.mediaType === "video" ? "#C1432B" : "#3D7EA6",
  });

  if (error) return { error: error.message };
  revalidatePath(`/athletes/${parsed.data.athleteId}/evolucao`);
  return { success: true };
}
