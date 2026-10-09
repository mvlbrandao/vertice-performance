/**
 * Marca de "este erro já foi registrado", para o mesmo erro não virar duas
 * linhas em system_events: uma pelo captador do próprio webhook e outra pelo
 * onRequestError do Next (que recebe a exceção quando ela escapa da rota).
 *
 * Fica em globalThis, e não numa variável do módulo, porque o instrumentation
 * e as rotas são empacotados separadamente e podem carregar cópias distintas
 * deste arquivo; o globalThis é o único ponto comum do processo. WeakSet para
 * não segurar o erro (nem a pilha dele) na memória.
 *
 * Se o Next entregar ao onRequestError uma cópia do erro em vez da instância
 * original, a marca não casa e o evento vem em dobro: o custo é um número a
 * mais no grupo, não um dado perdido.
 */
const KEY = Symbol.for("vertice.observability.erros-registrados");

type Armazem = { [KEY]?: WeakSet<object> };

function armazem(): WeakSet<object> {
  const g = globalThis as Armazem;
  return (g[KEY] ??= new WeakSet<object>());
}

export function markRecorded(error: unknown): void {
  try {
    if (typeof error === "object" && error !== null) armazem().add(error);
  } catch {
    // Marcar é só otimização; nunca pode atrapalhar.
  }
}

export function wasRecorded(error: unknown): boolean {
  try {
    return typeof error === "object" && error !== null && armazem().has(error);
  } catch {
    return false;
  }
}
