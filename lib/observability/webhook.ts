import "server-only";
import { markRecorded } from "@/lib/observability/dedupe";
import { recordSystemEvent } from "@/lib/observability/record";
import { classifySeverity } from "@/lib/observability/severity";
import { messageOf, sanitizeMessage } from "@/lib/observability/sanitize";

/**
 * Captura de falhas dos webhooks (source = webhook em system_events).
 *
 * O Asaas reenvia o evento quando recebe 5xx; uma exceção aqui, sem ninguém
 * olhando, é cobrança que não foi baixada. O onRequestError do Next já recebe
 * a exceção que escapa de uma rota, mas o captador explícito garante a linha
 * com a rota estática (nunca o caminho real, que no webhook por clube carrega
 * o token de autenticação) e cobre também as falhas TRATADAS que devolvem 503.
 *
 * Contrato: não altera status, corpo nem autenticação. O wrapper devolve a
 * resposta do handler como veio e, se ele lançar, relança A MESMA exceção
 * depois de registrar (o Next responde 500 como respondia antes).
 */

/** Rota estática de cada webhook, já no formato normalizado da telemetria. */
export type WebhookRoute =
  | "/api/webhooks/asaas"
  | "/api/webhooks/asaas/:id"
  | "/api/webhooks/asaas-platform"
  | "/api/webhooks/asaas-withdraw-auth";

export function withWebhookCapture<Args extends unknown[]>(
  route: WebhookRoute,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      markRecorded(error);
      await recordWebhookFailure(route, error);
      throw error;
    }
  };
}

/** Registra uma falha de webhook. Nunca lança nem rejeita. */
export async function recordWebhookFailure(route: WebhookRoute, error: unknown): Promise<void> {
  try {
    const message = sanitizeMessage(messageOf(error));
    await recordSystemEvent({
      source: "webhook",
      severity: classifySeverity({ message }),
      route,
      method: "POST",
      statusCode: null,
      durationMs: null,
      message,
      digest: null,
      clubId: null,
    });
  } catch {
    // Telemetria nunca muda o resultado do webhook.
  }
}
