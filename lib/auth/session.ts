import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export interface SessionProfile {
  userId: string;
  email: string | null;
  clubId: string;
  role: UserRole;
  fullName: string;
  athleteId: string | null;
}

/**
 * Resolve o usuário autenticado + a linha correspondente em `profiles`.
 * Retorna null se não houver sessão ou se o profile ainda não existir
 * (ex.: conta de auth criada mas provisionamento em `profiles` pendente).
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role, full_name, athlete_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    clubId: profile.club_id,
    role: profile.role,
    fullName: profile.full_name,
    athleteId: profile.athlete_id,
  };
});
