"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const transferSchema = z.object({
  toPartnerClubId: z.string().uuid("Selecione o clube de destino."),
  toCategory: z.string().trim().optional(),
  transferredAt: z.string().min(1, "Informe a data da transferência."),
});

export async function transferAthleteClub(
  athleteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = transferSchema.safeParse({
    toPartnerClubId: formData.get("toPartnerClubId"),
    toCategory: formData.get("toCategory"),
    transferredAt: formData.get("transferredAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("team, category")
    .eq("id", athleteId)
    .eq("club_id", coach.clubId)
    .single();
  if (athleteError || !athlete) return { error: "Atleta não encontrado." };

  const { data: toClub, error: toClubError } = await supabase
    .from("partner_clubs")
    .select("id, name")
    .eq("id", parsed.data.toPartnerClubId)
    .single();
  if (toClubError || !toClub) return { error: "Clube de destino inválido." };

  let fromPartnerClubId: string | null = null;
  if (athlete.team) {
    const { data: fromClub } = await supabase
      .from("partner_clubs")
      .select("id")
      .eq("club_id", coach.clubId)
      .eq("name", athlete.team)
      .maybeSingle();
    fromPartnerClubId = fromClub?.id ?? null;
  }

  const { error: transferError } = await supabase.from("athlete_club_transfers").insert({
    athlete_id: athleteId,
    club_id: coach.clubId,
    from_partner_club_id: fromPartnerClubId,
    from_category: athlete.category,
    to_partner_club_id: toClub.id,
    to_category: parsed.data.toCategory || null,
    transferred_at: parsed.data.transferredAt,
    created_by: coach.userId,
  });
  if (transferError) return { error: transferError.message };

  const { error: updateError } = await supabase
    .from("athletes")
    .update({ team: toClub.name, category: parsed.data.toCategory || null })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/athletes/${athleteId}/dados`);
  revalidatePath(`/athletes/${athleteId}/evolucao`);
  revalidatePath("/athletes");
  return { success: true };
}
