/**
 * Normalização de rota para a telemetria. PURA.
 *
 * Duas razões para nunca gravar o caminho cru:
 *  1. segurança: o endereço traz segredo (`/convite/<token>`,
 *     `/api/webhooks/asaas/<token>`) e query string pode trazer sessão;
 *  2. utilidade: `/athletes/123/dados` e `/athletes/456/dados` são a MESMA
 *     tela. Sem agrupar, cada atleta vira uma rota e nenhuma estatística
 *     (erro, Web Vitals) junta amostras suficientes para dizer algo.
 *
 * O servidor normaliza sozinho, inclusive o que o navegador manda nos Web
 * Vitals: o cliente é de quem usa o sistema, não é de confiança.
 */

const MAX_ROUTE_LENGTH = 200;
const MAX_SEGMENT_LENGTH = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONLY_DIGITS = /^\d+$/;
const HEX_ID = /^[0-9a-f]{8,}$/i;

/**
 * Prefixos cujo segmento seguinte é sempre dinâmico, mesmo curto ou escrito
 * em palavras. A heurística de tamanho não pega um slug de clube
 * (`/c/vertice-demo`) nem um token que por azar saiu curto. Manter alinhado
 * às pastas `[param]` de app/ que NÃO são numéricas/UUID.
 */
const DYNAMIC_AFTER: ReadonlyArray<readonly string[]> = [
  ["c"],
  ["convite"],
  ["api", "webhooks", "asaas"],
];

function isDynamicSegment(segment: string): boolean {
  if (segment === "") return false;
  if (UUID.test(segment) || ONLY_DIGITS.test(segment) || HEX_ID.test(segment)) return true;
  // E-mail ou texto codificado na URL: nunca é nome de tela.
  if (segment.includes("@") || segment.includes("%")) return true;
  if (segment.length > MAX_SEGMENT_LENGTH) return true;
  // Nome de tela é minúsculo com hífen ("evolucao-financeira-sub"). Segmento
  // longo com dígito, maiúscula ou sublinhado é token (base64url, hash).
  if (segment.length >= 16 && /[\dA-Z_]/.test(segment)) return true;
  return false;
}

function matchesDynamicPrefix(parts: readonly string[], index: number): boolean {
  return DYNAMIC_AFTER.some(
    (prefix) =>
      prefix.length === index && prefix.every((value, i) => parts[i]?.toLowerCase() === value),
  );
}

function pathnameOf(input: string): string {
  let path = input.trim();
  // URL absoluta: só interessa o caminho (e o host nem deve ser gravado).
  const absolute = path.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i);
  if (absolute) path = absolute[1];
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  return path;
}

/**
 * Caminho real -> rota agrupada. `/athletes/8f14e45f-.../dados?x=1` vira
 * `/athletes/:id/dados`. Entrada vazia ou lixo vira "/" (nunca lança).
 */
export function normalizeRoute(input: string | null | undefined): string {
  if (typeof input !== "string") return "/";
  const parts = pathnameOf(input).split("/").filter(Boolean);
  if (parts.length === 0) return "/";

  const out = parts.map((segment, index) => {
    if (matchesDynamicPrefix(parts, index)) return ":id";
    return isDynamicSegment(segment) ? ":id" : segment;
  });

  const route = `/${out.join("/")}`;
  return route.length > MAX_ROUTE_LENGTH ? route.slice(0, MAX_ROUTE_LENGTH) : route;
}

/**
 * Padrão de rota do Next (`context.routePath`) -> mesmo formato de
 * normalizeRoute, para erros e Web Vitals da mesma tela caírem na mesma linha.
 *
 * O Next entrega o padrão do arquivo, como "/(coach)/athletes/[athleteId]/dados/page":
 * tira grupos de rota "(x)", slots "@x" e o sufixo /page ou /route, e troca
 * "[id]", "[...x]" e "[[...x]]" por ":id". Devolve null quando não é um padrão
 * utilizável (quem chama cai no caminho real normalizado).
 */
export function routeFromPattern(pattern: string | null | undefined): string | null {
  if (typeof pattern !== "string" || !pattern.startsWith("/")) return null;

  const segments = pattern
    .split("/")
    .filter(Boolean)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"));

  const last = segments[segments.length - 1];
  if (last === "page" || last === "route") segments.pop();

  const out = segments.map((s) => (s.startsWith("[") && s.endsWith("]") ? ":id" : s));
  const route = `/${out.join("/")}`;
  return route.length > MAX_ROUTE_LENGTH ? route.slice(0, MAX_ROUTE_LENGTH) : route;
}
