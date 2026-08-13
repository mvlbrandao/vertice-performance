import "server-only";
import { getSessionProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/**
 * Quem administra a plataforma (nós), não um clube.
 *
 * Deliberadamente **não** é um papel no banco com policy de RLS que enxerga
 * todos os clubes: uma policy assim enfraqueceria o isolamento de todo o
 * sistema pra sempre, e bastaria um engano numa consulta pra vazar dados
 * entre clubes. Em vez disso, a área roda só no servidor com service role,
 * e o portão é esta lista de e-mails.
 *
 * PLATFORM_ADMIN_EMAILS aceita vários separados por vírgula.
 */
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(): Promise<boolean> {
  const profile = await getSessionProfile();
  if (!profile?.email) return false;
  const allowed = platformAdminEmails();
  // Lista vazia bloqueia todo mundo. O contrário — liberar geral quando a
  // variável falta — transformaria um esquecimento de configuração numa
  // porta aberta pra qualquer usuário logado.
  if (allowed.length === 0) return false;
  return allowed.includes(profile.email.toLowerCase());
}

export async function requirePlatformAdmin() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!(await isPlatformAdmin())) {
    // 404 em vez de "sem permissão": a área não deve nem revelar que existe
    // pra quem não é da plataforma.
    redirect("/dashboard");
  }
  return profile;
}
