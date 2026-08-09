"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const partnerClubSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do clube."),
});

export async function createPartnerClub(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = partnerClubSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_clubs").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
  });
  if (error) {
    if (error.code === "23505") return { error: "Esse clube já existe." };
    return { error: error.message };
  }

  revalidatePath("/clube");
  return { success: true };
}

export async function deletePartnerClub(partnerClubId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_clubs")
    .delete()
    .eq("id", partnerClubId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/clube");
  return { success: true };
}

const categorySchema = z.object({
  partnerClubId: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome do sub."),
});

export async function createPartnerClubCategory(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = categorySchema.safeParse({
    partnerClubId: formData.get("partnerClubId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_club_categories").insert({
    club_id: coach.clubId,
    partner_club_id: parsed.data.partnerClubId,
    name: parsed.data.name,
  });
  if (error) {
    if (error.code === "23505") return { error: "Esse sub já existe nesse clube." };
    return { error: error.message };
  }

  revalidatePath("/clube");
  return { success: true };
}

export async function deletePartnerClubCategory(categoryId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_club_categories")
    .delete()
    .eq("id", categoryId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/clube");
  return { success: true };
}
