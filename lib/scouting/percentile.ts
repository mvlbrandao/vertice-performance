/**
 * Parte pura da comparação entre atletas (percentil e nuvens de pares).
 * Separada de peerScoring.ts, que lê o banco e importa "server-only", para
 * poder ser testada.
 */

/** Menos que isso e o percentil vira ruído (e identifica quem está na amostra). */
export const AMOSTRA_MINIMA = 5;
/**
 * Teto de atletas na amostra do percentil entre clubes. É o que mantém o
 * custo de calcular a distribuição constante enquanto a plataforma cresce.
 */
export const AMOSTRA_MAXIMA = 200;

export interface Ponto {
  x: number;
  y: number;
}

export interface PercentilSistema {
  attackPercentile: number;
  defensePercentile: number;
  sampleSize: number;
}

/** Elemento da amostra guardada em cache. O id nunca sai do servidor. */
export interface ParAmostrado {
  id: string;
  attack: number;
  defense: number;
}

/**
 * Posição de `value` entre `values` (0-100). Empates contam meio ponto, para
 * que um grupo todo igual dê 50 e não 0 ou 100.
 */
export function percentileRank(value: number, values: number[]) {
  if (values.length === 0) return 50;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}

/**
 * Percentil do atleta contra a amostra do sistema.
 *
 * O valor do próprio atleta vem de fora, calculado ao vivo, e o par dele é
 * retirado da amostra se estiver lá: a amostra pode ter alguns minutos e, sem
 * isso, ele seria contado duas vezes (uma com a nota velha, outra com a atual).
 *
 * `sampleSize` é o número de atletas realmente comparados (os outros da
 * amostra mais ele mesmo). Abaixo de AMOSTRA_MINIMA devolve null.
 */
export function calcularPercentilSistema(
  atletaId: string,
  proprio: Ponto,
  amostra: ParAmostrado[],
): PercentilSistema | null {
  const outros = amostra.filter((p) => p.id !== atletaId);
  const sampleSize = outros.length + 1;
  if (sampleSize < AMOSTRA_MINIMA) return null;

  return {
    attackPercentile: percentileRank(proprio.x, [...outros.map((p) => p.attack), proprio.x]),
    defensePercentile: percentileRank(proprio.y, [...outros.map((p) => p.defense), proprio.y]),
    sampleSize,
  };
}

/**
 * Nuvens do clube e do sub, a partir de UMA lista de pares já calculada.
 * Devolve só coordenadas: nenhum id, nome ou categoria de outro atleta.
 *
 * Sem categoria, o "sub" é o clube inteiro — o mesmo comportamento que a
 * consulta filtrada tinha quando `category` vinha vazio.
 */
export function derivarNuvens(
  pares: { category: string | null; attack: number; defense: number }[],
  category: string | null,
): { categoryCloud: Ponto[]; clubCloud: Ponto[] } {
  const clubCloud = pares.map((p) => ({ x: p.attack, y: p.defense }));
  if (!category) return { categoryCloud: clubCloud, clubCloud };
  const categoryCloud = pares
    .filter((p) => p.category === category)
    .map((p) => ({ x: p.attack, y: p.defense }));
  return { categoryCloud, clubCloud };
}
