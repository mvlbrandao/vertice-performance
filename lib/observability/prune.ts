/**
 * Retenção da telemetria: chama platform_prune_telemetry (migração 0074).
 * Sem "server-only" e recebendo o client por parâmetro para o teste exercitar
 * a tolerância à função ausente sem banco nenhum.
 *
 * A função platform_prune_telemetry ainda NÃO foi aplicada em produção (o dono
 * decidiu aplicá-la depois). Enquanto isso, o cron diário não pode falhar nem
 * ficar vermelho por isso: o resultado é `pendente`, vai para o resumo da
 * execução e a tela /admin/saude mostra o aviso permanente.
 */
import { sanitizeMessage } from "@/lib/observability/sanitize";
import { withTimeout } from "@/lib/observability/timeout";

export const TELEMETRY_KEEP_DAYS = 30;

/**
 * Prazo da chamada. A função apaga tudo o que passou do corte numa instrução
 * só: no dia a dia são poucas linhas, mas a primeira execução depois de meses
 * de coleta pode ser enorme, e o cron não deve ficar preso nela. Passou do
 * prazo, deixamos de esperar (o banco termina a instrução sozinho) e a
 * execução fica vermelha neste dia: é o sinal honesto de que a limpeza está
 * atrasada, e o dia seguinte continua de onde parou.
 */
export const PRUNE_TIMEOUT_MS = 15_000;

export type PruneStatus = "ok" | "pendente" | "falhou";

export interface PruneOutcome {
  status: PruneStatus;
  /** Contagem do que foi apagado, quando a função devolve (jsonb). */
  removed?: Record<string, unknown>;
  /** Só em `falhou`: mensagem já sanitizada. */
  message?: string;
}

interface ErrorLike {
  code?: string | null;
  message?: string | null;
}

/**
 * A função não existe no banco? O PostgREST responde PGRST202 ("Could not find
 * the function ... in the schema cache"); chamada direta em SQL daria 42883
 * (undefined_function). Os dois significam "migração pendente", não "falha".
 */
export function isMissingFunction(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

export function classifyPruneResult(result: { data: unknown; error: ErrorLike | null }): PruneOutcome {
  if (isMissingFunction(result.error)) return { status: "pendente" };
  if (result.error) {
    return { status: "falhou", message: sanitizeMessage(result.error.message ?? "erro desconhecido") };
  }
  const data = result.data;
  const removed =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  return removed ? { status: "ok", removed } : { status: "ok" };
}

/** O pedaço do client do Supabase que interessa aqui. */
export interface PruneClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: ErrorLike | null }>;
}

/** Nunca lança: erro de rede ou prazo vira `falhou`, função ausente vira `pendente`. */
export async function pruneTelemetry(
  client: PruneClient,
  keepDays: number = TELEMETRY_KEEP_DAYS,
): Promise<PruneOutcome> {
  try {
    return classifyPruneResult(
      await withTimeout(
        client.rpc("platform_prune_telemetry", { p_keep_days: keepDays }),
        PRUNE_TIMEOUT_MS,
        "platform_prune_telemetry",
      ),
    );
  } catch (e) {
    return { status: "falhou", message: sanitizeMessage(e) };
  }
}
