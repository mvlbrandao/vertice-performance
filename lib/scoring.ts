import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/utils/date";
import { chunk, lerTodasAsPaginas, mapComLimite } from "@/lib/utils/chunk";
import { calcularPlayerScore, type PlayerScore } from "@/lib/scoringCalc";

// A regra de cálculo mora em lib/scoringCalc.ts (pura, testável). Os tipos
// continuam saindo daqui porque é daqui que o resto do app os importa.
export type { PlayerScore } from "@/lib/scoringCalc";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/**
 * Ids por consulta. 100 UUIDs ≈ 4 KB de querystring, bem abaixo do teto
 * prático de 8 a 16 KB do PostgREST (ver lib/utils/chunk.ts).
 */
const ATLETAS_POR_FATIA = 100;
/** Fatias simultâneas: 3 × 7 consultas = no máximo 21 requisições em voo. */
const FATIAS_EM_PARALELO = 3;

export interface OpcoesScore {
  /**
   * Lança se qualquer consulta falhar, em vez de seguir com linhas faltando.
   * O padrão (false) degrada como sempre degradou: a tela abre e a dimensão
   * sem dados fica neutra. Quem grava o resultado em cache precisa de `true`,
   * senão uma falha momentânea vira uma distribuição errada que dura o TTL.
   */
  falharEmErro?: boolean;
}

/** Agrupa as linhas por atleta uma única vez, em vez de filtrar por atleta. */
function agrupar<T extends { athlete_id: string }>(linhas: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.athlete_id);
    if (atual) atual.push(linha);
    else mapa.set(linha.athlete_id, [linha]);
  }
  return mapa;
}

/**
 * As 7 leituras de uma fatia de atletas. Cada uma é paginada: o PostgREST
 * corta em 1000 linhas e, somando vários atletas, a súmula passa disso fácil.
 * `.order("id")` mantém as páginas consistentes entre si.
 */
async function lerFatia(supabase: Cliente, ids: string[]) {
  const [events, exercises, meetings, mentalNotes, swotItems, athletes, lineups] = await Promise.all([
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("game_events")
        .select("athlete_id, event_type, game_id")
        .in("athlete_id", ids)
        .order("id")
        .range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("exercises")
        .select("athlete_id, done")
        .in("athlete_id", ids)
        .order("id")
        .range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("meetings")
        .select("athlete_id, athlete_confirmed")
        .in("athlete_id", ids)
        .neq("status", "Cancelado")
        .order("id")
        .range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("mental_notes")
        .select("athlete_id, confidence_score")
        .in("athlete_id", ids)
        .not("confidence_score", "is", null)
        .order("id")
        .range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("athlete_swot_items")
        .select("athlete_id, status")
        .in("athlete_id", ids)
        .in("category", ["Fraqueza", "Ameaça"])
        .order("id")
        .range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase.from("athletes").select("id, position").in("id", ids).order("id").range(de, ate),
    ),
    lerTodasAsPaginas((de, ate) =>
      supabase
        .from("game_lineups")
        .select("athlete_id, game_id, games(scheduled_date)")
        .in("athlete_id", ids)
        .order("id")
        .range(de, ate),
    ),
  ]);

  const leituras = { events, exercises, meetings, mentalNotes, swotItems, athletes, lineups };
  const erros = Object.entries(leituras)
    .filter(([, leitura]) => leitura.erro)
    .map(([tabela, leitura]) => `${tabela}: ${leitura.erro}`);

  return {
    events: events.linhas,
    exercises: exercises.linhas,
    meetings: meetings.linhas,
    mentalNotes: mentalNotes.linhas,
    swotItems: swotItems.linhas,
    athletes: athletes.linhas,
    lineups: lineups.linhas,
    erros,
  };
}

/**
 * Score de vários atletas de uma vez.
 *
 * O custo é de 7 consultas por fatia de 100 atletas (mais uma página extra
 * para cada leitura que passar de 1000 linhas), independentemente de quantos
 * atletas a tela mostra. Uma lista de 180 atletas — medida no clube de
 * demonstração — levava 11 segundos quando era uma chamada por atleta. O
 * cálculo em si acontece em memória, na regra de lib/scoringCalc.ts.
 *
 * Toda id pedida aparece no mapa de retorno, mesmo sem nenhum dado (nota
 * neutra). Ids repetidas são calculadas uma vez.
 */
export async function computePlayerScores(
  supabase: Cliente,
  athleteIds: string[],
  opcoes: OpcoesScore = {},
): Promise<Map<string, PlayerScore>> {
  const ids = [...new Set(athleteIds)];
  const resultado = new Map<string, PlayerScore>();
  if (ids.length === 0) return resultado;

  const hoje = hojeISO();
  const erros: string[] = [];
  const calculados = new Map<string, PlayerScore>();

  await mapComLimite(chunk(ids, ATLETAS_POR_FATIA), FATIAS_EM_PARALELO, async (fatia) => {
    const linhas = await lerFatia(supabase, fatia);
    erros.push(...linhas.erros);

    const eventosPor = agrupar(linhas.events);
    const exerciciosPor = agrupar(linhas.exercises);
    const encontrosPor = agrupar(linhas.meetings);
    const notasPor = agrupar(linhas.mentalNotes);
    const swotPor = agrupar(linhas.swotItems);
    const escalacoesPor = agrupar(linhas.lineups);
    const posicaoPor = new Map(linhas.athletes.map((a) => [a.id, a.position ?? []]));

    for (const id of fatia) {
      calculados.set(
        id,
        calcularPlayerScore({
          hoje,
          eventos: eventosPor.get(id) ?? [],
          exercicios: exerciciosPor.get(id) ?? [],
          encontros: encontrosPor.get(id) ?? [],
          confiancas: (notasPor.get(id) ?? []).map((n) => n.confidence_score),
          swot: swotPor.get(id) ?? [],
          posicoes: posicaoPor.get(id) ?? [],
          escalacoes: (escalacoesPor.get(id) ?? []).map((l) => ({
            game_id: l.game_id,
            data: (l.games as unknown as { scheduled_date: string } | null)?.scheduled_date ?? null,
          })),
        }),
      );
    }
  });

  if (erros.length > 0) {
    const mensagem = `falha ao ler dados do score (${erros.join("; ")})`;
    if (opcoes.falharEmErro) throw new Error(mensagem);
    // Antes o erro era descartado e a tela mostrava nota neutra como se
    // fosse real. Continua degradando, mas agora deixa rastro.
    console.error(`[score] ${mensagem}`);
  }

  // Devolve na ordem pedida, não na ordem em que as fatias terminaram.
  for (const id of ids) resultado.set(id, calculados.get(id) as PlayerScore);
  return resultado;
}

/**
 * Score de um atleta. É a versão em lote com uma id só: assim as consultas,
 * os filtros e a regra existem num lugar só. Antes eram duas cópias, e a
 * comparação linha a linha não achou divergência numérica entre elas — mas
 * qualquer ajuste futuro de filtro teria que lembrar de mexer nas duas.
 */
export async function computePlayerScore(
  supabase: Cliente,
  athleteId: string,
  opcoes: OpcoesScore = {},
): Promise<PlayerScore> {
  const scores = await computePlayerScores(supabase, [athleteId], opcoes);
  // computePlayerScores devolve uma entrada para cada id pedida.
  return scores.get(athleteId) as PlayerScore;
}
