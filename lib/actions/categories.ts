"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
});

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
  });
  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: error.message };
  }

  revalidatePath("/clube");
  return { success: true };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/clube");
  return { success: true };
}
