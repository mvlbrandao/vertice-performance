import type { Json } from "@/lib/types/database";

/**
 * Prepara o `details` da trilha de auditoria da plataforma para ir ao banco.
 * Pura e sem "server-only": é a barreira que impede segredo de parar numa
 * tabela que fica para sempre (ela é só de acréscimo), então precisa ser
 * testada de verdade.
 *
 * Três garantias:
 *  1. JSON válido — undefined some, Date vira ISO, NaN vira null;
 *  2. nada com cara de segredo passa, nem pelo nome do campo nem pelo valor;
 *  3. tamanho limitado — uma resposta de API despejada por engano não pode
 *     inflar a tabela.
 */

export const REDACTED = "[omitido]";

const MAX_DEPTH = 6;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_KEYS = 60;
const MAX_JSON_CHARS = 16_000;

/**
 * Nome de campo que carrega credencial. Cobre os casos reais do projeto
 * (ASAAS_API_KEY, tokens de webhook, CREDENTIALS_ENCRYPTION_KEY, service role,
 * cookies de sessão) sem pegar "price_cents" ou "trial_ends_at".
 */
const SECRET_KEY =
  /(api[_-]?key|apikey|secret|token|passw|senha|authorization|cookie|credential|private[_-]?key|service[_-]?role|encryption[_-]?key)/i;

/** Valor que parece credencial mesmo num campo de nome inocente. */
const SECRET_VALUES: RegExp[] = [
  /\$?aact_[A-Za-z0-9_\-.]{8,}/g, // chave de API do Asaas
  /Bearer\s+[A-Za-z0-9._~+/=\-]{8,}/gi,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
];

function scrubString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUES) out = out.replace(pattern, REDACTED);
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…` : out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clean(value: unknown, depth: number): Json | undefined {
  if (value === null) return null;
  switch (typeof value) {
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    case "string":
      return scrubString(value);
    case "number":
      return Number.isFinite(value) ? value : null;
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (depth >= MAX_DEPTH) return "[profundo demais]";

  if (Array.isArray(value)) {
    const items: Json[] = [];
    for (const item of value.slice(0, MAX_ARRAY)) {
      // undefined dentro de array vira null para manter as posições.
      items.push(clean(item, depth + 1) ?? null);
    }
    return items;
  }

  if (isPlainObject(value)) {
    const out: { [key: string]: Json | undefined } = {};
    for (const key of Object.keys(value).slice(0, MAX_KEYS)) {
      if (SECRET_KEY.test(key)) {
        out[key] = REDACTED;
        continue;
      }
      const cleaned = clean(value[key], depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  // Instância de classe, Map, Set, Error...: não há como saber o que é seguro
  // gravar, então vira texto curto em vez de despejar campos internos.
  return scrubString(String(value));
}

/**
 * Sempre devolve um objeto: a coluna é `jsonb not null default '{}'` e a tela
 * espera pares nome/valor. Um valor solto é embrulhado em { valor }.
 */
export function normalizeAuditDetails(input: unknown): { [key: string]: Json | undefined } {
  if (input === null || input === undefined) return {};

  const cleaned = clean(input, 0);
  const result: { [key: string]: Json | undefined } =
    cleaned !== null && typeof cleaned === "object" && !Array.isArray(cleaned)
      ? cleaned
      : { valor: cleaned ?? null };

  if (JSON.stringify(result).length > MAX_JSON_CHARS) {
    return { truncado: true, campos: Object.keys(result).slice(0, MAX_KEYS) };
  }
  return result;
}
