import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computePlayerScores } from "@/lib/scoring";
import { lerTodasAsPaginas } from "@/lib/utils/chunk";
import {
  AMOSTRA_MAXIMA,
  calcularPercentilSistema,
  derivarNuvens,
  type ParAmostrado,
  type PercentilSistema,
  type Ponto,
} from "@/lib/scouting/percentile";

/**
 * Dados de comparação pra ficha do atleta: um atleta só pode ler o próprio
 * registro via RLS, então essas funções usam o client admin pra calcular o
 * score de colegas/pares — mas só retornam números anônimos (sem id, nome ou
 * qualquer campo identificável), nunca uma linha individual de outro atleta.
 * Escopo "clube"/"sub" fica dentro do próprio tenant (mesma proteção que o
 * treinador já tem); escopo "sistema" atravessa clubes, por isso retorna só
 * o percentil do próprio atleta dentro da distribuição — nenhum ponto
 * individual de outro clube é exposto.
 *
 * Custo por visualização do perfil: antes era 7 consultas POR atleta
 * comparado (e o clube era calculado duas vezes). Agora o clube inteiro é
 * calculado em lote uma única vez, o sub sai dele filtrando em memória, e
 * tanto os pares do clube quanto a amostra do percentil entre clubes ficam em
 * cache por alguns minutos.
 */

const SEM_NUVENS = { categoryCloud: [] as Ponto[], clubCloud: [] as Ponto[] };

/** Por quanto tempo os pares de um clube valem. Ver lerParesDoClube. */
const TTL_PARES_DO_CLUBE_SEGUNDOS = 300;

/** Elemento da lista em cache. Os ids só servem para tirar o próprio atleta. */
interface ParDoClube extends ParAmostrado {
  category: string | null;
}

/**
 * Ataque e defesa de todos os atletas ativos do clube, o próprio incluído:
 * uma leitura de atletas + o score em lote. A lista é a mesma para qualquer
 * atleta do clube, por isso dá para cachear por clube e tirar quem está vendo
 * em memória, depois.
 *
 * Falha lança (falharEmErro): lançar impede o cache de guardar pares com a
 * nota neutra de "dado que não carregou" por todo o TTL.
 */
async function carregarParesDoClube(clubId: string): Promise<ParDoClube[]> {
  const admin = createAdminClient();
  const { linhas: atletas, erro } = await lerTodasAsPaginas((de, ate) =>
    admin
      .from("athletes")
      .select("id, category")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .order("id")
      .range(de, ate),
  );
  if (erro) throw new Error(`atletas do clube: ${erro}`);
  if (atletas.length === 0) return [];

  const scores = await computePlayerScores(
    admin,
    atletas.map((a) => a.id),
    { falharEmErro: true },
  );
  return atletas.map((a) => {
    const s = scores.get(a.id) as { attack: number; defense: number };
    return { id: a.id, category: a.category, attack: s.attack, defense: s.defense };
  });
}

/**
 * Cache por clube (o clube entra na chave pelo argumento). Sem ele, cada
 * abertura de perfil recalculava o clube inteiro: 7 consultas por 100 atletas
 * (mais páginas extras onde a súmula passa de 1000 linhas), então um clube de
 * 400 gastava umas 30 consultas por visualização, e o custo crescia com o
 * clube. Agora um acesso a cada TTL paga o cálculo.
 *
 * 5 minutos: a nuvem de colegas é só o fundo do gráfico, e o ponto do próprio
 * atleta é sempre ao vivo. Mesmas ressalvas de lerAmostraDaCategoria sobre
 * onde o Data Cache vive. A lista guardada tem ids de colegas do MESMO clube
 * e nunca sai do servidor.
 */
const lerParesDoClube = unstable_cache(carregarParesDoClube, ["scouting-club-peers-v1"], {
  revalidate: TTL_PARES_DO_CLUBE_SEGUNDOS,
  tags: ["club-peer-cloud"],
});

/**
 * Nuvens de pontos (ataque × defesa) dos colegas do clube, por sub e geral,
 * sem o próprio atleta.
 *
 * Se a leitura falhar devolve nuvens vazias: preferimos o gráfico sem pares
 * a pares com a nota neutra de "dado que não carregou" (ver falharEmErro).
 */
export async function getClubPeerClouds(
  clubId: string,
  excludeAthleteId: string,
  category: string | null,
): Promise<{ categoryCloud: Ponto[]; clubCloud: Ponto[] }> {
  try {
    const pares = await lerParesDoClube(clubId);
    return derivarNuvens(
      pares.filter((p) => p.id !== excludeAthleteId),
      category,
    );
  } catch (e) {
    console.error("[scouting] falha ao montar a nuvem do clube:", (e as Error).message);
    return SEM_NUVENS;
  }
}

/** Por quanto tempo a amostra de uma categoria vale. Ver lerAmostraDaCategoria. */
const TTL_AMOSTRA_SEGUNDOS = 600;

/**
 * Amostra de atletas ativos da categoria, de TODOS os clubes, com o score de
 * ataque e defesa de cada um.
 *
 * Por que amostra e por que não os snapshots: o percentil antes carregava
 * todos os atletas da categoria na plataforma inteira e calculava o score de
 * cada um (7 consultas × N), então o custo de abrir o perfil crescia com o
 * tamanho do sistema. A alternativa óbvia, uma função SQL sobre o último
 * registro de athlete_score_snapshots, daria um percentil errado: o snapshot
 * só é gravado quando o PRÓPRIO atleta abre /perfil (getScoreChange), só quando
 * o geral muda (ataque e defesa podem ter mudado sem isso) e atleta que nunca
 * abriu o perfil não tem linha nenhuma.
 *
 * A amostra pega os primeiros AMOSTRA_MAXIMA por id. O id é um UUID aleatório,
 * então a ordem é efetivamente aleatória, mas estável: a mesma amostra sai
 * enquanto a população não muda, sem sorteio a cada requisição.
 *
 * Falha lança (falharEmErro): lançar impede o cache de guardar uma
 * distribuição de notas neutras por todo o TTL.
 */
async function carregarAmostraDaCategoria(category: string): Promise<ParAmostrado[]> {
  const admin = createAdminClient();
  const { data: atletas, error } = await admin
    .from("athletes")
    .select("id")
    .eq("category", category)
    .eq("is_active", true)
    .order("id")
    .limit(AMOSTRA_MAXIMA);
  if (error) throw new Error(`amostra da categoria: ${error.message}`);
  if (!atletas || atletas.length === 0) return [];

  const ids = atletas.map((a) => a.id);
  const scores = await computePlayerScores(admin, ids, { falharEmErro: true });
  return ids.map((id) => {
    const s = scores.get(id) as { attack: number; defense: number };
    return { id, attack: s.attack, defense: s.defense };
  });
}

/**
 * Cache da amostra por categoria (a categoria entra na chave pelo argumento).
 *
 * unstable_cache grava no Data Cache do Next, que na Vercel é compartilhado
 * entre as instâncias: um acesso a cada TTL por categoria paga o cálculo e
 * todos os outros leem pronto. Em hospedagem sem cache compartilhado (várias
 * instâncias próprias, cada uma com o seu cache em disco) cada instância paga
 * o cálculo uma vez por TTL — ainda limitado, só menos eficiente. O projeto
 * não usa cacheComponents, então a diretiva "use cache" não está disponível.
 *
 * 10 minutos: a posição de um atleta entre centenas de outros não muda de
 * forma perceptível nesse intervalo, e a posição DELE é sempre ao vivo.
 *
 * A amostra guardada contém ids de atletas de outros clubes. Ela só existe
 * no servidor (Data Cache do Next) e serve para retirar o próprio atleta da
 * conta; nada disso chega ao navegador, que recebe só o percentil.
 */
const lerAmostraDaCategoria = unstable_cache(
  carregarAmostraDaCategoria,
  ["scouting-system-sample-v1"],
  { revalidate: TTL_AMOSTRA_SEGUNDOS, tags: ["system-percentile"] },
);

/**
 * Percentil do atleta entre os atletas do mesmo sub em todo o sistema.
 *
 * `proprio` é o ataque/defesa dele calculado ao vivo pela página; só a
 * distribuição dos outros vem do cache. Retorna null sem categoria, com menos
 * de AMOSTRA_MINIMA atletas comparáveis ou se a amostra não puder ser lida.
 *
 * Diferença sutil herdada: o `proprio` vem da sessão do atleta, e a RLS só
 * deixa ele ver escalações de jogos com escalação publicada; os pares são
 * calculados com o client admin, que vê todas. A penalidade de "seca de gols"
 * pode então divergir um pouco entre ele e a amostra.
 */
export async function getSystemPercentile(
  athleteId: string,
  category: string | null,
  proprio: { attack: number; defense: number },
): Promise<PercentilSistema | null> {
  if (!category) return null;
  try {
    const amostra = await lerAmostraDaCategoria(category);
    return calcularPercentilSistema(athleteId, { x: proprio.attack, y: proprio.defense }, amostra);
  } catch (e) {
    console.error("[scouting] falha ao calcular o percentil do sistema:", (e as Error).message);
    return null;
  }
}
