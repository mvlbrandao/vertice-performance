import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/observability/rateLimit";
import { VITALS_RATE_MAX, VITALS_RATE_WINDOW_MS, ingestVital } from "@/lib/observability/vitalsIngest";

/**
 * Recebe os Web Vitals medidos no navegador de quem usa o sistema (RUM) e
 * grava em web_vitals (migração 0074). Toda a regra está em
 * lib/observability/vitalsIngest.ts; aqui só se ligam as peças reais.
 *
 * Um envio por página (até 5 métricas): UMA validação de sessão e UM insert em
 * lote. Exige sessão: sem ela qualquer um poderia encher a tabela. A sessão é
 * conferida no Auth (getUser), não lida do cookie. O proxy.ts também chama
 * getUser() neste pedido (o matcher cobre /api) e não repassa o resultado;
 * trocar esta chamada por getClaims() evitaria a segunda ida ao Auth ao custo
 * de aceitar um JWT já revogado até expirar. Fica como decisão do dono.
 * Grava com a service role porque a tabela não tem política para usuários; o
 * id do usuário serve só para o limite e NÃO é gravado.
 *
 * O limite é por instância (memória do processo); ver vitalsIngest.ts.
 */
const limiter = createRateLimiter({ max: VITALS_RATE_MAX, windowMs: VITALS_RATE_WINDOW_MS });

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
    insert: (rows) => createAdminClient().from("web_vitals").insert(rows),
  });

  // Sem corpo em nenhuma resposta: nada de detalhe sobre por que recusou.
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}
