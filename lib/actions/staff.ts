"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import { translateAuthError } from "@/lib/utils/authErrors";
import { logAudit } from "@/lib/actions/auditLog";

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
    return {
      error: inviteError
        ? translateAuthError(inviteError.message)
        : "Não foi possível convidar o profissional.",
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    club_id: coach.clubId,
    role: "staff",
    full_name: parsed.data.fullName,
    title: parsed.data.title || null,
  });
  if (profileError) return { error: profileError.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: invited.user.id,
    action: "create",
    details: { staff_name: parsed.data.fullName, email: parsed.data.email, title: parsed.data.title || null },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

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

  // Quem pode ver a ficha de quem é a pergunta central de privacidade
  // aqui: dado de saúde e de menor de idade passam por essa concessão.
  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: staffProfileId,
    action: "grant",
    details: { access_level: accessLevel },
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId,
  });

  revalidatePath("/equipe");
  return { success: true };
}

export async function updateStaffAreas(
  staffProfileId: string,
  areas: string[],
): Promise<ActionResult> {
  const coach = await requireCoach();

  // Client de serviço porque não existe mais policy de escrita em
  // `profiles` — ela permitia que um atleta virasse treinador de outro
  // clube. Esta ação escreve no perfil de OUTRA pessoa, então nunca teria
  // funcionado pela policy antiga (que só permitia id = auth.uid()): ela
  // falhava em silêncio, atualizando zero linhas sem devolver erro.
  //
  // A checagem de escopo passa a ser explícita aqui: precisa ser staff, do
  // clube deste treinador. É o mesmo filtro de antes, agora com efeito.
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ staff_areas: areas })
    .eq("id", staffProfileId)
    .eq("club_id", coach.clubId)
    .eq("role", "staff")
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "Profissional não encontrado neste clube." };
  }

  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: staffProfileId,
    action: "edit",
    details: { staff_areas: areas },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

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

  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: staffProfileId,
    action: "revoke",
    details: {},
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId,
  });

  revalidatePath("/equipe");
  return { success: true };
}
