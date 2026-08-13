import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";

/**
 * Faixa fixa dentro do clube de demonstração.
 *
 * Sem ela, o visitante que gostou não tem para onde ir: contratar de dentro
 * da demo assinaria o clube de demonstração, que é compartilhado com todos
 * os outros visitantes — o que ele precisa é criar o clube dele. A faixa
 * existe para transformar interesse em cadastro no momento em que o
 * interesse existe, sem obrigar a pessoa a procurar o caminho.
 *
 * Só aparece no clube marcado como demo; num clube real seria ruído.
 */
export async function DemoBanner() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const admin = createAdminClient();
  const { data: club } = await admin
    .from("clubs")
    .select("is_demo")
    .eq("id", profile.clubId)
    .maybeSingle();

  if (!club?.is_demo) return null;

  const settings = await getPlatformSettings();

  return (
    <div className="flex items-center gap-3.5 bg-amber text-pitch-dark rounded-md px-4 py-3 mb-4 flex-wrap print:hidden">
      <span className="text-xl shrink-0">👀</span>
      <div className="flex-1 min-w-[220px]">
        <b className="block text-sm">Você está numa demonstração</b>
        <span className="text-xs opacity-80">
          Os dados são fictícios e voltam ao normal todo dia. Crie o seu clube e comece com{" "}
          {settings.trialDays} dias grátis.
        </span>
      </div>
      <Link
        href="/cadastro"
        className="inline-flex items-center justify-center rounded-sm bg-pitch-dark text-chalk font-semibold px-3.5 py-2 text-[12.5px] shrink-0 hover:brightness-125"
      >
        Criar meu clube grátis
      </Link>
    </div>
  );
}
