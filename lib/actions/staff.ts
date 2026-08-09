"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const inviteStaffSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  title: z.string().trim().optional(),
});

/**
 * Convida um profissional (staff) pro clube, sem acesso a nenhum atleta até
 * que o coach conceda explicitamente via grantAthleteAccess. Mesmo padrão de
 * provisionAthleteAccount: único ponto que usa a service_role key aqui.
 */
export async function inviteStaff(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = inviteStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: parsed.data.fullName } },
  );
  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Não foi possível convidar o profissional." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    club_id: coach.clubId,
    role: "staff",
    full_name: parsed.data.fullName,
    title: parsed.data.title || null,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/equipe");
  return { success: true };
}

export async function grantAthleteAccess(
  staffProfileId: string,
  athleteId: string,
  accessLevel: "view" | "manage" = "manage",
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase.from("athlete_staff_access").upsert(
    {
      club_id: coach.clubId,
      athlete_id: athleteId,
      staff_profile_id: staffProfileId,
      access_level: accessLevel,
      granted_by: coach.userId,
    },
    { onConflict: "athlete_id,staff_profile_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true };
}

export async function updateStaffAreas(
  staffProfileId: string,
  areas: string[],
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ staff_areas: areas })
    .eq("id", staffProfileId)
    .eq("club_id", coach.clubId)
    .eq("role", "staff");
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true };
}

export async function revokeAthleteAccess(
  staffProfileId: string,
  athleteId: string,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_staff_access")
    .delete()
    .eq("club_id", coach.clubId)
    .eq("staff_profile_id", staffProfileId)
    .eq("athlete_id", athleteId);
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true };
}
