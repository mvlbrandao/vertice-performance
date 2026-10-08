/**
 * Severidade de um evento de falha. PURA.
 *
 * Só há dois níveis na tabela (`warn` e `error`) e a tela pinta o semáforo a
 * partir deles, então a regra precisa ser conservadora: na dúvida, `error`.
 * Um erro real rebaixado a aviso some do semáforo; um aviso promovido a erro
 * só faz barulho.
 *
 * `warn` é para o que NÃO é defeito do nosso código:
 *  - resposta 4xx (o pedido estava errado, o servidor fez o certo);
 *  - quem pediu desistiu no meio (aba fechada, rede móvel caiu);
 *  - tela aberta de um deploy antigo chamando uma ação que não existe mais
 *    (acontece em onda a cada publicação e se resolve sozinho no recarregar).
 */
const BENIGN_PATTERNS: readonly RegExp[] = [
  /failed to find server action/i,
  /\bECONNRESET\b/,
  /\baborted\b/i,
  /\bAbortError\b/,
  /socket hang up/i,
  /client (?:has )?disconnected/i,
  /unexpected end of form/i,
];

export type EventSeverity = "warn" | "error";

export function classifySeverity(input: {
  message: string;
  statusCode?: number | null;
}): EventSeverity {
  const status = input.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) return "warn";
  if (BENIGN_PATTERNS.some((pattern) => pattern.test(input.message))) return "warn";
  return "error";
}
