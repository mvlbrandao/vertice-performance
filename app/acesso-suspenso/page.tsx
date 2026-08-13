import { getSessionProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getClubLicense } from "@/lib/platform/license";

/**
 * O que atleta e profissional veem quando o clube perde acesso.
 *
 * Fora do grupo (coach)/(athlete) de propósito: aqueles layouts chamam os
 * guards, que redirecionariam pra cá de novo, em laço.
 */
export default async function AcessoSuspensoPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  // Se o acesso voltou, não deixa a pessoa presa nesta tela.
  try {
    const license = await getClubLicense(profile.clubId);
    if (license.allowed) {
      redirect(profile.role === "coach" ? "/dashboard" : profile.role === "staff" ? "/meus-atletas" : "/perfil");
    }
  } catch {
    // Falha ao consultar não deve prender ninguém aqui.
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-pitch-dark">
      <div className="bg-white rounded-lg w-full max-w-[440px] p-7">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" />
          <span className="font-display text-lg tracking-wide">VÉRTICE PERFORMANCE</span>
        </div>
        <h1 className="text-[20px] m-0 mb-2">Acesso do clube suspenso</h1>
        <p className="text-[13.5px] text-ink-soft m-0 mb-3">
          O acesso do seu clube está temporariamente suspenso. Nenhum dado foi perdido — assim
          que a situação for regularizada, tudo volta como estava.
        </p>
        <p className="text-[13px] text-ink-faint m-0">
          Fale com quem administra o clube para saber mais.
        </p>
      </div>
    </div>
  );
}
