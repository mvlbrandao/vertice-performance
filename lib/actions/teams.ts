"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const teamSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do time."),
});

export async function createTeam(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = teamSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
  });
  if (error) {
    if (error.code === "23505") return { error: "Esse time já existe." };
    return { error: error.message };
  }

  revalidatePath("/clube");
  return { success: true };
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/clube");
  return { success: true };
}
