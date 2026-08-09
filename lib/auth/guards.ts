import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/session";

function roleHome(role: SessionProfile["role"]) {
  if (role === "coach") return "/dashboard";
  if (role === "staff") return "/meus-atletas";
  return "/perfil";
}

export async function requireCoach(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect(roleHome(profile.role));
  return profile;
}

export async function requireAthlete(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "athlete") redirect(roleHome(profile.role));
  return profile;
}

export async function requireStaff(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "staff") redirect(roleHome(profile.role));
  return profile;
}
