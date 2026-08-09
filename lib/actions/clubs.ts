"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const clubSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do clube."),
});

export async function updateClub(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = clubSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clubs")
    .update({ name: parsed.data.name })
    .eq("id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/clube");
  return { success: true };
}
