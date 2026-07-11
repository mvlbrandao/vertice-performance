import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role === "coach" ? "/dashboard" : "/perfil");

  return <LoginForm />;
}
