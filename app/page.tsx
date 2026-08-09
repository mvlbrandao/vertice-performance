import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export default async function Home() {
  const profile = await getSessionProfile();

  if (!profile) redirect("/login");
  if (profile.role === "coach") redirect("/dashboard");
  if (profile.role === "staff") redirect("/meus-atletas");
  redirect("/perfil");
}
