/**
 * Ferramentas para não estourar o PostgREST ao consultar muitos ids.
 *
 * Dois limites do Supabase morderam este código e nenhum deles dá erro claro:
 *
 * 1. `.in("coluna", ids)` vira querystring. Cada UUID ocupa ~39 caracteres e
 *    o teto prático da URL fica entre 8 e 16 KB, ou seja, algumas centenas
 *    de ids. Estourou, a consulta falha e quem descarta `error` (como o
 *    cálculo de score fazia) recebe `data: null` e segue em frente com
 *    resultado "vazio" — todo mundo ganhava a nota neutra, sem aviso.
 * 2. O PostgREST corta toda resposta em 1000 linhas (`max-rows`). Uma fatia
 *    de 100 atletas com 20 eventos de súmula cada já passa disso, e o corte
 *    é silencioso: o score sai errado sem nenhuma exceção.
 *
 * Por isso fatiar a lista de ids (`chunk`) não basta: cada fatia ainda precisa
 * ser lida página a página (`lerTodasAsPaginas`).
 */

/** Divide em fatias de até `tamanho` itens, preservando a ordem. */
export function chunk<T>(itens: readonly T[], tamanho: number): T[][] {
  if (!Number.isInteger(tamanho) || tamanho < 1) {
    throw new RangeError(`chunk: tamanho deve ser um inteiro >= 1 (recebido ${tamanho}).`);
  }
  const fatias: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    fatias.push(itens.slice(i, i + tamanho));
  }
  return fatias;
}

/**
 * Como `Promise.all(itens.map(fn))`, mas com no máximo `limite` chamadas em
 * voo ao mesmo tempo. Cada fatia de atletas dispara 7 consultas; sem teto, 30
 * fatias seriam 210 requisições simultâneas contra o banco. O resultado
 * respeita a ordem de `itens`, não a de conclusão.
 */
export async function mapComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new RangeError(`mapComLimite: limite deve ser um inteiro >= 1 (recebido ${limite}).`);
  }
  const resultados = new Array<R>(itens.length);
  let proximo = 0;

  async function trabalhador() {
    for (;;) {
      const indice = proximo++;
      if (indice >= itens.length) return;
      resultados[indice] = await fn(itens[indice], indice);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

/** Forma mínima da resposta do supabase-js que `lerTodasAsPaginas` consome. */
export interface RespostaPagina<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Valor padrão do `max-rows` do PostgREST no Supabase hospedado. */
export const LINHAS_POR_PAGINA = 1000;

/**
 * Lê uma consulta inteira, página a página, até a página vir incompleta.
 *
 * `lerPagina(de, ate)` deve aplicar `.range(de, ate)` e uma ordenação estável
 * (`.order("id")`): sem ordem, linhas podem repetir ou sumir entre páginas.
 * Pressupõe que o servidor devolve páginas cheias de `linhasPorPagina`; se o
 * `max-rows` do projeto for menor que isso, a leitura pararia cedo — por isso
 * o padrão é o 1000 documentado do Supabase.
 *
 * Não lança: devolve o que leu e a mensagem do primeiro erro, para o chamador
 * decidir entre degradar (tela) ou falhar (cálculo que vai para cache).
 */
export async function lerTodasAsPaginas<T>(
  lerPagina: (de: number, ate: number) => PromiseLike<RespostaPagina<T>>,
  linhasPorPagina: number = LINHAS_POR_PAGINA,
  maxPaginas = 100,
): Promise<{ linhas: T[]; erro: string | null }> {
  const linhas: T[] = [];
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const de = pagina * linhasPorPagina;
    const { data, error } = await lerPagina(de, de + linhasPorPagina - 1);
    if (error) return { linhas, erro: error.message };
    const recebidas = data ?? [];
    linhas.push(...recebidas);
    if (recebidas.length < linhasPorPagina) return { linhas, erro: null };
  }
  // Teto de segurança contra laço infinito (servidor ignorando o range).
  // Devolver como erro, e não como "terminou", evita um número parcial passar
  // por completo.
  return { linhas, erro: `leitura interrompida após ${maxPaginas} páginas` };
}
