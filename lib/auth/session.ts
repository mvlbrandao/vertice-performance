import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
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
 * Cliente de sessão + usuário validado no servidor do Auth (getUser confere o
 * token; ler o cookie sozinho não prova nada). Com cache() porque a pergunta
 * "quem é" é feita por vários guards na mesma requisição — o de clube, o da
 * área de administração, o menu — e cada getUser é uma ida ao Auth.
 *
 * Devolve o MESMO cliente que fez o getUser: se o token precisou ser
 * renovado no meio, as consultas seguintes usam a sessão renovada em memória
 * (um cliente novo leria o cookie velho, que um Server Component não consegue
 * reescrever).
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
});

export async function getAuthUser(): Promise<User | null> {
  return (await getAuthContext()).user;
}

/** Página inicial de cada papel de clube. */
export function roleHomePath(role: UserRole): string {
  if (role === "coach") return "/dashboard";
  if (role === "staff") return "/meus-atletas";
  return "/perfil";
}

/**
 * Resolve o usuário autenticado + a linha correspondente em `profiles`.
 * Retorna null se não houver sessão ou se o profile ainda não existir
 * (ex.: conta de auth criada mas provisionamento em `profiles` pendente).
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const { supabase, user } = await getAuthContext();
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
