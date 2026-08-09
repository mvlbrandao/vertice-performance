"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const athleteSchema = z.object({
  fullName: z.string().trim().min(1, "Nome é obrigatório."),
  birthDate: z.string().optional(),
  category: z.string().trim().optional(),
  position: z.string().trim().optional(),
  team: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
});

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function createAthlete(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();

  const parsed = athleteSchema.safeParse({
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    category: formData.get("category"),
    position: formData.get("position"),
    team: formData.get("team"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    instagram: formData.get("instagram"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const colors = ["#111111", "#D72B2B", "#E6C000", "#1A1A1A", "#C0392B"];
  const photoColor = colors[Math.floor(Math.random() * colors.length)];

  const { error } = await supabase.from("athletes").insert({
    club_id: coach.clubId,
    created_by: coach.userId,
    full_name: parsed.data.fullName,
    birth_date: parsed.data.birthDate || null,
    category: parsed.data.category || null,
    position: parsed.data.position || null,
    team: parsed.data.team || null,
    guardian_name: parsed.data.guardianName || null,
    guardian_phone: parsed.data.guardianPhone || null,
    instagram: parsed.data.instagram || null,
    photo_color: photoColor,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  return { success: true };
}

const athleteUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Nome é obrigatório."),
  birthDate: z.string().optional(),
  category: z.string().trim().optional(),
  position: z.string().trim().optional(),
  team: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  athletePhone: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
});

export async function updateAthlete(
  athleteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const coach = await requireCoach();

  const parsed = athleteUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    category: formData.get("category"),
    position: formData.get("position"),
    team: formData.get("team"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    athletePhone: formData.get("athletePhone"),
    instagram: formData.get("instagram"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const heightCm = parsed.data.heightCm ? Number(parsed.data.heightCm) : null;
  const weightKg = parsed.data.weightKg ? Number(parsed.data.weightKg) : null;
  const bmi =
    heightCm && weightKg
      ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
      : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({
      full_name: parsed.data.fullName,
      birth_date: parsed.data.birthDate || null,
      category: parsed.data.category || null,
      position: parsed.data.position || null,
      team: parsed.data.team || null,
      guardian_name: parsed.data.guardianName || null,
      guardian_phone: parsed.data.guardianPhone || null,
      athlete_phone: parsed.data.athletePhone || null,
      instagram: parsed.data.instagram || null,
      height_cm: heightCm,
      weight_kg: weightKg,
      bmi,
    })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);

  if (error) return { error: error.message };

  revalidatePath(`/athletes/${athleteId}/dados`);
  revalidatePath("/athletes");
  return { success: true };
}
