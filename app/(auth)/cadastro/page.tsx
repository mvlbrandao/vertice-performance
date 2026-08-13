import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/platform/license";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function CadastroPage() {
  const profile = await getSessionProfile();
  if (profile) {
    redirect(
      profile.role === "coach" ? "/dashboard" : profile.role === "staff" ? "/meus-atletas" : "/perfil",
    );
  }

  const settings = await getPlatformSettings();
  return <SignupForm trialDays={settings.trialDays} maxAthletes={settings.maxAthletes} />;
}
