/**
 * Contas de abas roláveis na horizontal. Ficam fora do componente para
 * serem testáveis sem DOM: o componente só lê as medidas do elemento e
 * aplica o resultado.
 */

export interface ScrollMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/**
 * Para que lado ainda há conteúdo escondido. A tolerância absorve o
 * arredondamento fracionário de scrollLeft em telas com zoom/densidade
 * alta — sem ela, uma faixa que já chegou no fim ainda acusaria 0,4px
 * sobrando e a sombra nunca sumiria.
 */
export function overflowEdges(m: ScrollMetrics, tolerance = 2): { start: boolean; end: boolean } {
  const max = m.scrollWidth - m.clientWidth;
  if (max <= tolerance) return { start: false, end: false };
  return {
    start: m.scrollLeft > tolerance,
    end: m.scrollLeft < max - tolerance,
  };
}

/**
 * scrollLeft que deixa o item centralizado na faixa, limitado aos extremos:
 * a primeira aba não precisa de "folga" à esquerda e a última não pode
 * passar do fim, então o centro só vale no meio da lista.
 */
export function scrollLeftToCenter(args: {
  containerWidth: number;
  scrollWidth: number;
  itemLeft: number;
  itemWidth: number;
}): number {
  const max = Math.max(0, args.scrollWidth - args.containerWidth);
  const centered = args.itemLeft - (args.containerWidth - args.itemWidth) / 2;
  return Math.min(max, Math.max(0, Math.round(centered)));
}
