"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

/**
 * Grava o caminho da foto do atleta. Toda action exposta pelo "use server" é
 * um endpoint chamável por qualquer sessão autenticada, então aqui não se
 * confia só na RLS: confirma que quem chama é treinador, que o atleta é do
 * clube dele, e que o caminho aponta pra pasta do próprio clube (o storage
 * usa o formato clubId/athleteId/arquivo). Sem isso, a única barreira seria
 * a política de RLS — e uma mudança futura nela abriria um buraco silencioso.
 */
export async function setAthletePhotoPath(
  athleteId: string,
  storagePath: string,
): Promise<ActionResult> {
  const coach = await requireCoach();

  if (!storagePath.startsWith(`${coach.clubId}/${athleteId}/`)) {
    return { error: "Caminho de arquivo inválido." };
  }

  const supabase = await createClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("club_id", coach.clubId)
    .maybeSingle();
  if (!athlete) return { error: "Atleta não encontrado no seu clube." };

  const { error } = await supabase
    .from("athletes")
    .update({ photo_url: storagePath })
    .eq("id", athleteId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath(`/athletes/${athleteId}`);
  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  return { success: true };
}
