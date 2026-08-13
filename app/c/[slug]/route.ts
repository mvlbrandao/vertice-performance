import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SLUG_COOKIE } from "@/lib/clubLink";

/**
 * Link próprio do cliente: /c/nome-do-clube.
 *
 * É porta de entrada, não um prefixo de rota. O app inteiro continua em /
 * — duplicar cada tela sob /c/<slug> seria refazer o roteamento inteiro
 * para ganhar só o endereço. Aqui a gente resolve o clube, guarda num
 * cookie e manda pro login, que passa a mostrar de qual clube é o convite.
 *
 * O isolamento nunca dependeu da URL: quem entra vai pro clube do próprio
 * perfil, com RLS por club_id. O slug serve para o cliente ter um endereço
 * seu e para a demonstração abrir no clube certo. Quando houver domínio,
 * cliente.verticepf.com.br faz exatamente isto no middleware, sem mexer no
 * resto.
 *
 * Usa o client de serviço porque quem abre o link ainda não tem sessão —
 * mas só chama club_by_slug, que devolve nome e situação e mais nada.
 */


export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("club_by_slug", { p_slug: slug.toLowerCase() });
  const club = Array.isArray(data) ? data[0] : null;

  const origin = new URL(request.url).origin;

  // Falha de consulta não é slug errado. Tratar as duas do mesmo jeito foi
  // o que escondeu um problema de ambiente em produção: o link do clube
  // dizia "esse link não existe" enquanto o clube estava lá, intacto.
  if (error) {
    console.error("[/c/slug] falha ao resolver o clube:", error.message, error.code ?? "");
    return NextResponse.redirect(`${origin}/login?clube=erro`);
  }

  if (!club || club.status === "bloqueado") {
    // Link errado ou clube encerrado: manda pro login normal em vez de
    // 404, porque quem chega aqui quase sempre digitou algo errado e o
    // que ele quer é entrar.
    //
    // Apagar o cookie é parte da correção: sem isso a tela dizia "esse
    // link não existe" exibindo o crachá do clube visitado antes, que é
    // pior que não mostrar nada.
    const erro = NextResponse.redirect(
      `${origin}/login?clube=${club ? "bloqueado" : "desconhecido"}`,
    );
    erro.cookies.delete(CLUB_SLUG_COOKIE);
    return erro;
  }

  const response = NextResponse.redirect(`${origin}/login`);
  response.cookies.set(CLUB_SLUG_COOKIE, club.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
  });
  return response;
}
