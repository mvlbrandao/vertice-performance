/**
 * Do erro cru do Next (onRequestError) ao rascunho de evento que vai para o
 * banco. PURA: sem "server-only", sem rede, sem hash — record.ts grava.
 *
 * Só sai daqui o que é seguro e útil: rota normalizada, método, mensagem
 * limpa, digest. Cabeçalhos, cookies, corpo e usuário NUNCA são lidos (o
 * `request.headers` que o Next entrega nem é tocado): quem quiser guardar
 * mais precisa mudar este arquivo, à vista de quem revisa.
 */
import type { SystemEventSource } from "@/lib/types/database";
import { messageOf, sanitizeMessage } from "@/lib/observability/sanitize";
import { normalizeRoute, routeFromPattern } from "@/lib/observability/route";
import { classifySeverity, type EventSeverity } from "@/lib/observability/severity";

export interface SystemEventDraft {
  source: SystemEventSource;
  severity: EventSeverity;
  /** Já normalizada (ids viram :id, sem query string). */
  route: string;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  /** Já sanitizada e truncada. */
  message: string;
  digest: string | null;
  /** Só quando o chamador já tinha o clube em mãos; nunca buscado só para isto. */
  clubId: string | null;
}

/** O que o Next entrega a onRequestError (só o que usamos; headers ficam de fora de propósito). */
export interface RequestErrorRequest {
  path?: string;
  method?: string;
}
export interface RequestErrorContext {
  routePath?: string;
  routeType?: string;
}

// Sinais de controle que o Next lança como exceção para redirecionar, dar 404
// ou desistir do pré-render estático. Não são falhas e, sem este filtro,
// cada login e cada notFound() do portão de administração viraria "erro".
const CONTROL_DIGESTS = new Set(["DYNAMIC_SERVER_USAGE", "BAILOUT_TO_CLIENT_SIDE_RENDERING"]);
const CONTROL_MESSAGES = /^(?:NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)\b/;

function readString(value: unknown, key: "digest" | "message" | "name"): string | null {
  if (typeof value !== "object" || value === null) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}

export function isNextControlSignal(error: unknown): boolean {
  const digest = readString(error, "digest");
  if (digest && (digest.startsWith("NEXT_") || CONTROL_DIGESTS.has(digest))) return true;
  const message = readString(error, "message");
  return !!message && CONTROL_MESSAGES.test(message);
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function sourceFor(routeType: string | undefined, route: string): SystemEventSource {
  // Webhooks e crons são rotas de API, mas têm dono e urgência próprios: a tela
  // os separa de "route" para que falha de cobrança não se misture com o resto.
  if (route.startsWith("/api/webhooks/") || route === "/api/webhooks") return "webhook";
  if (route.startsWith("/api/cron/") || route === "/api/cron") return "cron";
  if (routeType === "render" || routeType === "route" || routeType === "action" || routeType === "proxy") {
    return routeType;
  }
  return "route";
}

/** Digest do Next: um número/hash curto. Só caracteres inofensivos e tamanho limitado. */
export function cleanDigest(digest: string | null): string | null {
  if (!digest) return null;
  const cleaned = digest.replace(/[^A-Za-z0-9_:;.-]/g, "").slice(0, 64);
  return cleaned === "" ? null : cleaned;
}

function describeMessage(error: unknown): string {
  const raw = messageOf(error);
  const name = readString(error, "name");
  // "TypeError: x is undefined" agrupa melhor do que "x is undefined" sozinho;
  // "Error" genérico não acrescenta nada.
  const prefixed = name && name !== "Error" && !raw.startsWith(name) ? `${name}: ${raw}` : raw;
  return sanitizeMessage(prefixed);
}

/**
 * Rascunho do evento, ou null quando não é para registrar (sinal de controle
 * do Next). Nunca lança.
 */
export function describeRequestError(
  error: unknown,
  request: RequestErrorRequest | undefined,
  context: RequestErrorContext | undefined,
): SystemEventDraft | null {
  try {
    if (isNextControlSignal(error)) return null;

    // No proxy o routePath não é uma rota de página: vale o caminho real.
    const fromPattern = context?.routeType === "proxy" ? null : routeFromPattern(context?.routePath);
    const route = fromPattern ?? normalizeRoute(request?.path);

    const method = request?.method?.toUpperCase();
    const message = describeMessage(error);

    return {
      source: sourceFor(context?.routeType, route),
      severity: classifySeverity({ message }),
      route,
      method: method && METHODS.has(method) ? method : null,
      statusCode: null,
      durationMs: null,
      message,
      digest: cleanDigest(readString(error, "digest")),
      clubId: null,
    };
  } catch {
    return null;
  }
}
