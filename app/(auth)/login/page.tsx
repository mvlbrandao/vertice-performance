import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionProfile, roleHomePath } from "@/lib/auth/session";
import { getPlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginForm } from "@/components/auth/LoginForm";
import { CLUB_SLUG_COOKIE } from "@/lib/clubLink";

type Search = Promise<{ clube?: string }>;

const AVISO: Record<string, string> = {
  desconhecido: "Esse link de clube não existe mais. Entre com seu e-mail e senha normalmente.",
  bloqueado: "O acesso desse clube está suspenso. Fale com quem administra a conta.",
  erro: "Não conseguimos carregar os dados do clube agora. Entre normalmente — se persistir, avise o suporte.",
};

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  // O administrador da plataforma pode não ter perfil de clube; sem esta
  // checagem a página de login o devolveria a si mesma para sempre.
  if (await getPlatformAdmin()) redirect("/admin");

  const profile = await getSessionProfile();
  if (profile) redirect(roleHomePath(profile.role));

  const { clube } = await searchParams;

  // O clube vem do cookie que /c/<slug> gravou. É só identidade visual —
  // quem entra vai pro clube do próprio perfil de qualquer jeito.
  const slug = (await cookies()).get(CLUB_SLUG_COOKIE)?.value;
  let clubName: string | null = null;
  let isDemo = false;

  if (slug) {
    const { data, error } = await createAdminClient().rpc("club_by_slug", { p_slug: slug });
    if (error) console.error("[login] falha ao ler o clube do cookie:", error.message);
    const found = Array.isArray(data) ? data[0] : null;
    if (found) {
      clubName = found.name;
      isDemo = found.is_demo;
    }
  }

  return <LoginForm clubName={clubName} isDemo={isDemo} aviso={clube ? AVISO[clube] : undefined} />;
}
