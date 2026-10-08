import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SystemEventDraft } from "@/lib/observability/capture";
import { cleanDigest } from "@/lib/observability/capture";
import { fingerprintKey } from "@/lib/observability/fingerprint";
import { createRateLimiter } from "@/lib/observability/rateLimit";
import { normalizeRoute } from "@/lib/observability/route";
import { sanitizeMessage } from "@/lib/observability/sanitize";
import { withTimeout } from "@/lib/observability/timeout";

/**
 * Grava um evento de falha em system_events (migração 0074).
 *
 * REGRA ABSOLUTA: registrar telemetria jamais pode lançar, atrasar a resposta
 * além do prazo nem mudar o resultado do pedido que falhou. Por isso o corpo
 * inteiro está num try/catch, a gravação tem prazo curto e tudo que dá errado
 * vira um `console.warn` e `false`. Quem chama pode ignorar o retorno.
 *
 * Cabeçalhos, cookies, corpo e id de usuário não passam por aqui (o tipo
 * SystemEventDraft nem tem onde carregá-los). O clube só vai quando quem
 * chama já o tinha em mãos.
 */

/** Prazo para gravar. Longo o bastante para uma ida ao banco, curto o bastante para não prender o pedido. */
export const RECORD_TIMEOUT_MS = 2_000;

/**
 * Máximo de gravações por impressão digital por minuto (por instância). Uma
 * falha em laço repete a mesma linha milhares de vezes; sem teto, o próprio
 * registro de erro derrubaria o banco que ele tenta proteger. As ocorrências
 * acima do teto são descartadas: o grupo já está visível com as primeiras.
 */
export const MAX_EVENTS_PER_FINGERPRINT_PER_MINUTE = 5;

const limiter = createRateLimiter({
  max: MAX_EVENTS_PER_FINGERPRINT_PER_MINUTE,
  windowMs: 60_000,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hash estável (SHA-256, 32 primeiros hex) da chave de impressão digital. */
export function hashFingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export interface RecordOptions {
  /**
   * Ignora o limitador. Só para quem já tem teto próprio (o wrapper de cron
   * registra no máximo algumas falhas por execução e uma vez por dia).
   */
  bypassLimiter?: boolean;
}

function clampInt(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

export async function recordSystemEvent(
  draft: SystemEventDraft,
  options: RecordOptions = {},
): Promise<boolean> {
  try {
    // Sanitiza e normaliza de novo: o rascunho pode vir de um chamador que
    // não passou por describeRequestError. Ambas as operações são idempotentes.
    const message = sanitizeMessage(draft.message);
    const route = normalizeRoute(draft.route);
    const fingerprint = hashFingerprint(fingerprintKey(draft.source, route, message));

    if (!options.bypassLimiter && !limiter.allow(fingerprint)) return false;

    const { error } = await withTimeout(
      createAdminClient()
        .from("system_events")
        .insert({
          severity: draft.severity,
          source: draft.source,
          route,
          method: draft.method,
          status_code: clampInt(draft.statusCode, 100, 599),
          duration_ms: clampInt(draft.durationMs, 0, 2_147_483_647),
          message,
          digest: cleanDigest(draft.digest),
          fingerprint,
          club_id: draft.clubId && UUID.test(draft.clubId) ? draft.clubId : null,
        }),
      RECORD_TIMEOUT_MS,
      "gravação de evento",
    );

    if (error) {
      console.warn("[telemetria] evento não gravado:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[telemetria] evento não gravado:", (e as Error)?.message);
    return false;
  }
}
