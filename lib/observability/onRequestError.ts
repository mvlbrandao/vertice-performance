import "server-only";
import {
  describeRequestError,
  type RequestErrorContext,
  type RequestErrorRequest,
} from "@/lib/observability/capture";
import { recordSystemEvent } from "@/lib/observability/record";

/**
 * Ponte entre o gancho `onRequestError` do Next (instrumentation.ts) e a
 * gravação em system_events. O Next espera que o gancho seja aguardado, então
 * isto devolve uma promessa; mesmo assim ela NUNCA rejeita: o erro original
 * já foi (ou será) respondido ao cliente e nada que aconteça aqui pode mudar
 * isso.
 *
 * Cobre tudo que o Next captura: renderização, rotas de API (inclusive os
 * webhooks e os crons, que viram `source = webhook` e `cron`), server actions
 * e proxy. Erros que o código trata com try/catch não chegam aqui — para
 * esses, quem trata registra se quiser (ver o catch do webhook por clube).
 */
export async function handleRequestError(
  error: unknown,
  request: RequestErrorRequest | undefined,
  context: RequestErrorContext | undefined,
): Promise<void> {
  try {
    const draft = describeRequestError(error, request, context);
    if (!draft) return;
    await recordSystemEvent(draft);
  } catch {
    // Telemetria não pode falhar a requisição que já falhou.
  }
}
