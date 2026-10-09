/**
 * Limpeza de mensagens de erro antes de irem para o banco. PURA (sem
 * "server-only", sem rede) para ser testada: é a barreira entre "o que a
 * exceção dizia" e "o que fica gravado por 30 dias numa tabela que o dono lê".
 *
 * O risco real não é o erro em si, é o que ele carrega sem querer: mensagens
 * de banco repetem o valor que violou a restrição (e-mail, CPF), URLs de
 * chamadas trazem token na query string, e erros de biblioteca embutem o
 * cabeçalho Authorization. Por isso a regra é remover o que tem CARA de dado
 * pessoal ou credencial, em vez de confiar que ninguém colocou isso numa
 * mensagem. Nomes de tabela, de restrição e o texto do erro continuam
 * legíveis: sem eles a mensagem não ajuda a achar o defeito.
 */

/** Tamanho máximo gravado. Mensagens maiores costumam ser stack ou corpo despejado. */
export const MAX_MESSAGE_LENGTH = 300;

/**
 * Teto de entrada antes das expressões regulares: uma "mensagem" de 2 MB (corpo
 * de resposta despejado numa exceção) não pode custar CPU no caminho do erro.
 */
const MAX_INPUT_LENGTH = 4_000;

const TOKEN_CHARS = "A-Za-z0-9_-";

// Ordem importa: o que é mais específico (JWT, e-mail, UUID) sai antes das
// regras genéricas de número e de "texto opaco", senão elas comeriam pedaços
// de um e-mail ou de um UUID e deixariam resto à mostra. O texto opaco (24+)
// vem ANTES de telefone e número pelo motivo inverso: um token hexadecimal com
// dígitos teria os números trocados por "[telefone]" e as letras sobrariam.
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // JWT: cabeçalho.corpo.assinatura em base64url; o cabeçalho começa com "eyJ" ('{"').
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*)?/g, "[token]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]"],
  // Classes Unicode: "josé@x.com" e "joão.silva@x.com" são e-mails de verdade
  // aqui; com [A-Za-z] o nome ficava pela metade na tela do dono.
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, "[email]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]"],
  // O Postgres repete o valor que violou a restrição: "Key (col)=(valor) already
  // exists". O nome da coluna ajuda a achar o defeito; o valor é do titular.
  [
    /\bKey \(([^)]*)\)=\(.*?\)(?=\s+(?:already exists|is (?:not present|still referenced))|\s*$)/gi,
    "Key ($1)=([valor])",
  ],
  [/\bKey \(([^)]*)\)=\([^)]*\)/gi, "Key ($1)=([valor])"],
  // "invalid input syntax for type uuid: \"Carlos Eduardo\"": o PostgREST devolve
  // na mensagem o texto digitado, que pode ser nome, data de nascimento, etc.
  [
    /\b(invalid input (?:syntax|value) [^:"]*|date\/time field value out of range|malformed [^:"]*?literal|invalid (?:regular expression|byte sequence)[^:"]*):\s*\\?"[^"]*"/gi,
    "$1: [valor]",
  ],
  // Query string: só quando há "?chave=valor". Um "?" de pergunta no fim da
  // frase não é tocado. Sai inteira: nunca guardamos o que foi pedido na URL.
  [/\?[^\s"'`<>]*=[^\s"'`<>]*/g, ""],
  // Credencial escrita como chave=valor, chave: valor ou "chave":"valor" (JSON),
  // fora de URL. O nome pode ter prefixo e sufixo ("client_secret", "x-api-key",
  // "secret_key"), e o valor pode vir depois do esquema ("Basic xxx"): sem
  // consumir o esquema, a regra levava a palavra "Basic" e deixava a credencial.
  // Prefixo e sufixo são sequências de [letras/dígitos] separadas por UM "_" ou
  // "-" (nunca "[\w-]+" dentro de "(...)*"): a partição fica única e o
  // retrocesso linear, em vez de exponencial numa mensagem hostil. O
  // lookbehind faz a busca começar só no início de cada palavra.
  [
    /(?<![A-Za-z0-9_-])((?:[A-Za-z0-9]+[_-])*(?:token|api[-_]?key|secret|password|passwd|senha|authorization)(?:[_-][A-Za-z0-9]+)*)\b["']?\s*[:=]\s*(?:(?:Basic|Bearer|Token)\s+)?["']?[^\s"',;&]+/gi,
    "$1=[removido]",
  ],
  // Texto opaco longo e misturado (letras + dígitos, 24+ caracteres): chave de API, hash.
  // Exige dígito E letra para não apagar nome de restrição como
  // "athlete_enrollment_requests_reviewed_by_fkey", que é justamente o que
  // explica um erro de chave estrangeira.
  [
    new RegExp(
      `(?<![${TOKEN_CHARS}])(?=[${TOKEN_CHARS}]*\\d)(?=[${TOKEN_CHARS}]*[A-Za-z])[${TOKEN_CHARS}]{24,}(?![${TOKEN_CHARS}])`,
      "g",
    ),
    "[token]",
  ],
  [/(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)/g, "[cnpj]"],
  [/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g, "[cpf]"],
  [/(?<!\d)\d{5}-\d{3}(?!\d)/g, "[cep]"],
  // Telefone brasileiro, com ou sem máscara/DDI: (83) 98888-7777, 83988887777, +55 83 ...
  [/(?<!\d)(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g, "[telefone]"],
  // Qualquer sequência longa de dígitos: CPF/CNPJ sem máscara, cartão, id numérico, timestamp.
  [/(?<!\d)\d{8,}(?!\d)/g, "[número]"],
];

/** Texto cru de qualquer valor lançado (Error, string, objeto com message, lixo). */
export function messageOf(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.message || value.name;
    if (typeof value === "object" && value !== null && "message" in value) {
      const message = (value as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
    return String(value);
  } catch {
    // toString hostil ou objeto sem protótipo: nunca pode derrubar o registro.
    return "";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, Math.max(1, max - 1));
  // Não deixa meio par substituto (emoji) pendurado no fim.
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Mensagem pronta para gravar: sem e-mail, UUID, token/JWT, CPF/CNPJ/telefone,
 * sequências longas de dígitos nem query string, em uma linha e com no máximo
 * `max` caracteres. Trunca DEPOIS de limpar: cortar antes poderia deixar a
 * metade de um segredo passar pela regra que o reconheceria inteiro.
 */
export function sanitizeMessage(value: unknown, max: number = MAX_MESSAGE_LENGTH): string {
  let text = messageOf(value).slice(0, MAX_INPUT_LENGTH);
  // Quebras de linha e caracteres de controle (C0 e C1) viram espaço (uma linha
  // só). Caracteres de formatação invisíveis (largura zero, sobrescrita
  // bidirecional U+202E) saem de vez: um deles no meio de "jo<ZWSP>hn@x.com"
  // quebraria o reconhecimento do e-mail, e a sobrescrita faria a mensagem
  // aparecer invertida na tela do dono.
  text = text
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\p{Cf}+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s+/g, " ").trim();

  if (text === "") return "(sem mensagem)";
  return truncate(text, max);
}
