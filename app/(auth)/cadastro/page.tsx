import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function CadastroPage() {
  const profile = await getSessionProfile();

  if (profile) {
    // Quem está na demonstração precisa poder se cadastrar sem sair antes.
    // Era o furo do botão "Criar meu clube grátis": o visitante da demo
    // está logado, então a página o devolvia para o painel da demo e o
    // botão parecia não fazer nada. Ao concluir, o login com as novas
    // credenciais substitui a sessão da demo.
    const admin = createAdminClient();
    const { data: club } = await admin
      .from("clubs")
      .select("is_demo")
      .eq("id", profile.clubId)
      .maybeSingle();

    if (!club?.is_demo) {
      redirect(
        profile.role === "coach"
          ? "/dashboard"
          : profile.role === "staff"
            ? "/meus-atletas"
            : "/perfil",
      );
    }
  }

  const settings = await getPlatformSettings();
  return (
    <SignupForm
      trialDays={settings.trialDays}
      maxAthletes={settings.maxAthletes}
      vindoDaDemo={!!profile}
    />
  );
}
