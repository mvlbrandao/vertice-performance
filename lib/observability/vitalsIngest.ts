/**
 * Regra de POST /api/telemetry/vitals, separada da rota para o teste exercitar
 * cada recusa sem montar sessão nem banco (a rota só liga as dependências
 * reais). Sem "server-only".
 *
 * Ordem pensada para gastar o mínimo com quem não devia estar aqui:
 *  1. corpo grande demais (cabeçalho e leitura limitada)  -> 413, sem tocar em nada;
 *  2. sem sessão válida                                    -> 401 (anônimo nunca grava);
 *  3. usuário acima do limite                              -> 204 (descarta calado);
 *  4. corpo ilegível ou inválido                           -> 400, sem detalhe do porquê;
 *  5. gravou, ou o banco falhou                            -> 204 nos dois casos.
 *
 * Telemetria é "melhor esforço": falha ao gravar NÃO vira erro para o
 * navegador (ninguém pode refazer, e um 5xx só polui o console da pessoa).
 */
import { MAX_BODY_BYTES, parseVitalPayload, type VitalRow } from "@/lib/observability/vitalsPayload";
import { withTimeout } from "@/lib/observability/timeout";

export const VITALS_INSERT_TIMEOUT_MS = 2_000;

export interface VitalsIngestDeps {
  /** Id do usuário com sessão VÁLIDA (conferida no Auth), ou null. Pode lançar. */
  userId: () => Promise<string | null>;
  /** Limitador por usuário. */
  allow: (userId: string) => boolean;
  /** Grava a linha. Pode lançar ou rejeitar. */
  insert: (row: VitalRow) => PromiseLike<unknown>;
}

/**
 * Lê o corpo como texto sem passar de `max` bytes. Devolve null se passou: o
 * Content-Length pode mentir ou faltar (chunked), então a leitura também conta.
 */
export async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;

  const reader = request.body?.getReader();
  if (!reader) return "";

  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export async function ingestVital(request: Request, deps: VitalsIngestDeps): Promise<number> {
  try {
    const text = await readBodyCapped(request, MAX_BODY_BYTES);
    if (text === null) return 413;

    let userId: string | null;
    try {
      userId = await deps.userId();
    } catch (e) {
      // O Auth fora do ar: nada a gravar, e nada que o navegador possa fazer.
      console.warn("[vitals] sessão não verificada:", (e as Error)?.message);
      return 204;
    }
    if (!userId) return 401;

    if (!deps.allow(userId)) return 204;

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return 400;
    }

    // O user-agent só decide mobile/desktop; não é gravado.
    const row = parseVitalPayload(json, request.headers.get("user-agent"));
    if (!row) return 400;

    try {
      const result = (await withTimeout(deps.insert(row), VITALS_INSERT_TIMEOUT_MS, "gravação de vital")) as
        | { error?: { message?: string } | null }
        | undefined;
      if (result?.error) console.warn("[vitals] não gravado:", result.error.message);
    } catch (e) {
      console.warn("[vitals] não gravado:", (e as Error)?.message);
    }
    return 204;
  } catch {
    // Nada deste caminho pode virar 500.
    return 204;
  }
}
