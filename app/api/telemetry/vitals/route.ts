import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/observability/rateLimit";
import { ingestVital } from "@/lib/observability/vitalsIngest";

/**
 * Recebe os Web Vitals medidos no navegador de quem usa o sistema (RUM) e
 * grava em web_vitals (migração 0074). Toda a regra está em
 * lib/observability/vitalsIngest.ts; aqui só se ligam as peças reais.
 *
 * Exige sessão: sem ela qualquer um poderia encher a tabela. A sessão é
 * conferida no Auth (getUser), não lida do cookie. Grava com a service role
 * porque a tabela não tem política para usuários; o id do usuário serve só
 * para o limite e NÃO é gravado.
 */
// 60 por minuto por usuário (por instância): um carregamento legítimo manda
// ~5 métricas; o teto só segura script em laço ou aba mal-comportada.
const limiter = createRateLimiter({ max: 60, windowMs: 60_000 });

export async function POST(request: Request) {
  const status = await ingestVital(request, {
    userId: async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    allow: (userId) => limiter.allow(userId),
    insert: (row) => createAdminClient().from("web_vitals").insert(row),
  });

  // Sem corpo em nenhuma resposta: nada de detalhe sobre por que recusou.
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}
