import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/session";
import { getClubLicense } from "@/lib/platform/license";

function roleHome(role: SessionProfile["role"]) {
  if (role === "coach") return "/dashboard";
  if (role === "staff") return "/meus-atletas";
  return "/perfil";
}

/**
 * Barra o clube cujo teste venceu ou cuja assinatura foi cortada.
 *
 * Só o dono continua entrando, e apenas na tela de assinatura — foi a
 * decisão do produto: se o atleta seguisse usando, o clube não sentiria o
 * vencimento e não haveria motivo pra pagar. Quem não é dono vê uma tela
 * explicando que o clube está com acesso suspenso.
 *
 * Falha de leitura da licença não bloqueia ninguém: um problema nosso não
 * pode derrubar o acesso de um cliente em dia.
 */
async function enforceLicense(profile: SessionProfile) {
  let license;
  try {
    license = await getClubLicense(profile.clubId);
  } catch (e) {
    console.error("[licenca] falha ao verificar, liberando acesso:", (e as Error).message);
    return;
  }

  if (license.allowed) return;

  const isOwner = profile.role === "coach";
  redirect(isOwner ? "/assinatura" : "/acesso-suspenso");
}

export async function requireCoach(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect(roleHome(profile.role));
  await enforceLicense(profile);
  return profile;
}

export async function requireAthlete(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "athlete") redirect(roleHome(profile.role));
  await enforceLicense(profile);
  return profile;
}

export async function requireStaff(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "staff") redirect(roleHome(profile.role));
  await enforceLicense(profile);
  return profile;
}

/** Para a própria tela de assinatura, que precisa carregar mesmo bloqueado. */
export async function requireCoachIgnoringLicense(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect(roleHome(profile.role));
  return profile;
}
