import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/session";

export async function requireCoach(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect("/perfil");
  return profile;
}

export async function requireAthlete(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "athlete") redirect("/dashboard");
  return profile;
}
