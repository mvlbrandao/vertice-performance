import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) {
    const destination =
      profile.role === "coach" ? "/dashboard" : profile.role === "staff" ? "/meus-atletas" : "/perfil";
    redirect(destination);
  }

  return <LoginForm />;
}
