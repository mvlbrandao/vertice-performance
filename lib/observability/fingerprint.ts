/**
 * Parte PURA da impressão digital de um erro. O hash em si (node:crypto) fica
 * em record.ts, na camada de servidor; aqui só se decide O QUE entra no hash,
 * que é a parte que define se mil ocorrências viram um grupo ou mil.
 *
 * A mesma falha precisa dar a mesma chave hoje, amanhã e em outra instância
 * serverless, mesmo que o texto mude em detalhes que não são a causa: um
 * id numérico, um carimbo de hora, a caixa das letras.
 */

// 2026-10-08, 2026-10-08T12:30:45.123Z, 2026-10-08 12:30
const DATE_TIME = /\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?z?)?/g;
// 6+ dígitos: id, timestamp, porta alta. Números curtos (409, 23503 = código
// de erro do Postgres, "coluna 3") ficam, porque costumam SER a causa.
const LONG_NUMBER = /\d{6,}/g;

/** Mensagem (já passada por sanitizeMessage) sem o que varia entre ocorrências da mesma falha. */
export function normalizeForFingerprint(message: string): string {
  return message
    .toLowerCase()
    .replace(DATE_TIME, "#")
    .replace(LONG_NUMBER, "#")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texto que vai ao hash: origem + rota normalizada + mensagem normalizada.
 * A rota entra porque o mesmo "Cannot read properties of undefined" em duas
 * telas são dois defeitos; a origem, porque um erro de render e um de cron com
 * a mesma frase têm donos diferentes.
 */
export function fingerprintKey(source: string, route: string, message: string): string {
  return `${source}|${route}|${normalizeForFingerprint(message)}`;
}
