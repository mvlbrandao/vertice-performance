"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const athleteSchema = z.object({
  fullName: z.string().trim().min(1, "Nome é obrigatório."),
  birthDate: z.string().optional(),
  category: z.string().trim().optional(),
  team: z.string().trim().optional(),
  sex: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  clubColor: z.string().trim().optional(),
});

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Aceita tanto vírgula quanto ponto como separador decimal (ex: "1,64" ou "1.64").
function parseDecimal(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// Aceita altura em metros (ex: "1,64") ou já em centímetros (ex: "164").
function parseHeightCm(raw: string | null | undefined): number | null {
  const value = parseDecimal(raw);
  if (value == null) return null;
  return Math.round(value <= 3 ? value * 100 : value);
}

function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

function parsePositions(formData: FormData): string[] | null {
  const positions = formData
    .getAll("position")
    .map((p) => String(p).trim())
    .filter(Boolean);
  return positions.length > 0 ? positions : null;
}

function parseSex(raw: string | undefined): "M" | "F" | null {
  return raw === "M" || raw === "F" ? raw : null;
}

export async function createAthlete(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();

  const parsed = athleteSchema.safeParse({
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    category: formData.get("category"),
    team: formData.get("team"),
    sex: formData.get("sex"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    instagram: formData.get("instagram"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
    clubColor: formData.get("clubColor"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const heightCm = parseHeightCm(parsed.data.heightCm);
  const weightKg = parseDecimal(parsed.data.weightKg);

  const supabase = await createClient();
  const fallbackColors = ["#111111", "#D72B2B", "#E6C000", "#1A1A1A", "#C0392B"];
  const photoColor =
    parsed.data.clubColor || fallbackColors[Math.floor(Math.random() * fallbackColors.length)];

  const { error } = await supabase.from("athletes").insert({
    club_id: coach.clubId,
    created_by: coach.userId,
    full_name: parsed.data.fullName,
    birth_date: parsed.data.birthDate || null,
    category: parsed.data.category || null,
    position: parsePositions(formData),
    team: parsed.data.team || null,
    sex: parseSex(parsed.data.sex),
    guardian_name: parsed.data.guardianName || null,
    guardian_phone: parsed.data.guardianPhone || null,
    instagram: parsed.data.instagram || null,
    photo_color: photoColor,
    height_cm: heightCm,
    weight_kg: weightKg,
    bmi: computeBmi(heightCm, weightKg),
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
  sex: z.string().trim().optional(),
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
    sex: formData.get("sex"),
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

  const heightCm = parseHeightCm(parsed.data.heightCm);
  const weightKg = parseDecimal(parsed.data.weightKg);

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({
      full_name: parsed.data.fullName,
      birth_date: parsed.data.birthDate || null,
      position: parsePositions(formData),
      sex: parseSex(parsed.data.sex),
      guardian_name: parsed.data.guardianName || null,
      guardian_phone: parsed.data.guardianPhone || null,
      athlete_phone: parsed.data.athletePhone || null,
      instagram: parsed.data.instagram || null,
      height_cm: heightCm,
      weight_kg: weightKg,
      bmi: computeBmi(heightCm, weightKg),
    })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);

  if (error) return { error: error.message };

  revalidatePath(`/athletes/${athleteId}/dados`);
  revalidatePath("/athletes");
  return { success: true };
}

export async function setAthleteActive(
  athleteId: string,
  active: boolean,
  reason?: string,
): Promise<ActionResult> {
  const coach = await requireCoach();

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({
      is_active: active,
      deactivated_at: active ? null : new Date().toISOString(),
      deactivation_reason: active ? null : reason?.trim() || null,
    })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);

  if (error) return { error: error.message };

  revalidatePath(`/athletes/${athleteId}/dados`);
  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { success: true };
}
