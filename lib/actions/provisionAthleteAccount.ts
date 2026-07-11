"use server";

import { requireCoach } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Único ponto do app que usa a service_role key. Cria (ou convida) uma conta
 * de login para um atleta já cadastrado pelo treinador, vinculando-a ao
 * registro em `athletes`. Nunca importar este módulo em um componente client.
 */
export async function provisionAthleteAccount({
  athleteId,
  email,
  fullName,
}: {
  athleteId: string;
  email: string;
  fullName: string;
}) {
  const coach = await requireCoach();

  // confirma que o atleta pertence ao clube do treinador autenticado antes de
  // qualquer operação privilegiada (a RLS normal não se aplica ao admin client)
  const supabase = await createClient();
  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id, club_id")
    .eq("id", athleteId)
    .single();

  if (athleteError || !athlete) {
    return { error: "Atleta não encontrado." };
  }
  if (athlete.club_id !== coach.clubId) {
    return { error: "Atleta não pertence ao seu clube." };
  }

  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: fullName } },
  );

  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Não foi possível convidar o atleta." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    club_id: athlete.club_id,
    role: "athlete",
    full_name: fullName,
    athlete_id: athlete.id,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  return { success: true };
}
