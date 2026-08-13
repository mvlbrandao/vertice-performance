import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/utils/date";

export interface PlayerScore {
  overall: number;
  attack: number;
  defense: number;
  discipline: number;
  physical: number;
  mental: number;
  commitment: number;
  development: number;
  warnings: string[];
}

const ATTACKING_POSITIONS = ["Atacante", "Pivô", "Ala"];
const COLD_STREAK_GAMES = 5;
const COLD_STREAK_MIN_GAMES = 3;
const COLD_STREAK_PENALTY = 12;

function clamp(n: number, min = 0, max = 99) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Nota 0-99 por atleta, estilo card de game, calculada só a partir do que já
 * é registrado no app (sem input manual extra):
 *
 * - Ataque: gols e assistências da súmula (peso maior pro gol), com bônus/
 *   penalidade pelas finalizações certas/erradas.
 * - Defesa: desarmes, interceptações e defesas (goleiro) da súmula.
 * - Disciplina: começa em 99 e desconta por cartão/falta na súmula.
 * - Físico: % de treinos prescritos concluídos.
 * - Mental: média da nota de confiança dos registros mentais (0-10 → 0-99).
 * - Compromisso: % de encontros confirmados pelo atleta.
 * - Desenvolvimento: % dos pontos de Fraqueza/Ameaça da análise SWOT (todos
 *   os ciclos) que já foram concluídos — mede se o plano de evolução está
 *   sendo executado, não só registrado.
 *
 * Categoria sem nenhum dado ainda fica em 50 (neutro) pra não penalizar um
 * atleta recém-cadastrado.
 */
export async function computePlayerScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<PlayerScore> {
  const today = hojeISO();
  const [
    { data: events },
    { data: exercises },
    { data: meetings },
    { data: mentalNotes },
    { data: swotItems },
    { data: athlete },
    { data: recentLineups },
  ] = await Promise.all([
    supabase
      .from("game_events")
      .select("event_type, game_id")
      .eq("athlete_id", athleteId),
    supabase.from("exercises").select("done").eq("athlete_id", athleteId),
    supabase
      .from("meetings")
      .select("athlete_confirmed")
      .eq("athlete_id", athleteId)
      .neq("status", "Cancelado"),
    supabase
      .from("mental_notes")
      .select("confidence_score")
      .eq("athlete_id", athleteId)
      .not("confidence_score", "is", null),
    supabase
      .from("athlete_swot_items")
      .select("status")
      .eq("athlete_id", athleteId)
      .in("category", ["Fraqueza", "Ameaça"]),
    supabase.from("athletes").select("position").eq("id", athleteId).single(),
    supabase
      .from("game_lineups")
      .select("game_id, games(scheduled_date)")
      .eq("athlete_id", athleteId),
  ]);

  const count = (type: string) => (events ?? []).filter((e) => e.event_type === type).length;
  const warnings: string[] = [];

  const hasEvents = (events ?? []).length > 0;
  let attack = hasEvents
    ? clamp(
        50 +
          count("Gol") * 8 +
          count("Assistência") * 5 +
          count("Finalização certa") * 2 -
          count("Finalização errada") * 1,
      )
    : 50;

  // Sinal negativo específico: atacante em "seca de gols" — jogou os
  // últimos jogos e não marcou nenhum. Puxa o ataque pra baixo mesmo que
  // o acumulado histórico ainda esteja alto.
  const isAttacker = (athlete?.position ?? []).some((p) => ATTACKING_POSITIONS.includes(p));
  const recentGameIds = (recentLineups ?? [])
    .map((l) => ({
      gameId: l.game_id,
      date: (l.games as unknown as { scheduled_date: string } | null)?.scheduled_date,
    }))
    .filter((g) => g.date && g.date <= today)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string))
    .slice(0, COLD_STREAK_GAMES)
    .map((g) => g.gameId);

  if (isAttacker && recentGameIds.length >= COLD_STREAK_MIN_GAMES) {
    const goalsInRecentGames = (events ?? []).filter(
      (e) => e.event_type === "Gol" && recentGameIds.includes(e.game_id),
    ).length;
    if (goalsInRecentGames === 0) {
      attack = clamp(attack - COLD_STREAK_PENALTY);
      warnings.push(
        `⚠️ Sem gols nas últimas ${recentGameIds.length} partidas — finalização penalizada no ataque.`,
      );
    }
  }
  const defense = hasEvents
    ? clamp(50 + count("Desarme") * 5 + count("Interceptação") * 4 + count("Defesa") * 6)
    : 50;
  const discipline = hasEvents
    ? clamp(99 - (count("Cartão amarelo") * 8 + count("Cartão vermelho") * 20 + count("Falta") * 3))
    : 99;

  const totalExercises = exercises?.length ?? 0;
  const physical = totalExercises
    ? clamp(30 + (exercises!.filter((e) => e.done).length / totalExercises) * 69)
    : 50;

  const confidenceScores = (mentalNotes ?? [])
    .map((m) => m.confidence_score)
    .filter((s): s is number => s != null);
  const mental = confidenceScores.length
    ? clamp((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 9.9)
    : 50;

  const totalMeetings = meetings?.length ?? 0;
  const commitment = totalMeetings
    ? clamp(30 + (meetings!.filter((m) => m.athlete_confirmed).length / totalMeetings) * 69)
    : 50;

  const totalSwotIssues = swotItems?.length ?? 0;
  const development = totalSwotIssues
    ? clamp(30 + (swotItems!.filter((s) => s.status === "Concluído").length / totalSwotIssues) * 69)
    : 50;

  const overall = clamp(
    (attack + defense + discipline + physical + mental + commitment + development) / 7,
  );

  return { overall, attack, defense, discipline, physical, mental, commitment, development, warnings };
}

/**
 * Mesma pontuação, mas para muitos atletas de uma vez.
 *
 * computePlayerScore faz seis consultas por atleta. Numa lista de 180 —
 * medido no clube de demonstração — isso vira mais de mil idas ao banco e
 * a tela levava 11 segundos para abrir. Aqui são sete consultas no total,
 * independentemente do tamanho do elenco, e o cálculo acontece em memória
 * reaproveitando exatamente a mesma regra.
 *
 * A função individual continua existindo: na ficha de um atleta ela é mais
 * simples e o custo é irrelevante.
 */
export async function computePlayerScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteIds: string[],
): Promise<Map<string, PlayerScore>> {
  const resultado = new Map<string, PlayerScore>();
  if (athleteIds.length === 0) return resultado;

  const today = hojeISO();
  const [
    { data: events },
    { data: exercises },
    { data: meetings },
    { data: mentalNotes },
    { data: swotItems },
    { data: athletes },
    { data: lineups },
  ] = await Promise.all([
    supabase.from("game_events").select("athlete_id, event_type, game_id").in("athlete_id", athleteIds),
    supabase.from("exercises").select("athlete_id, done").in("athlete_id", athleteIds),
    supabase
      .from("meetings")
      .select("athlete_id, athlete_confirmed")
      .in("athlete_id", athleteIds)
      .neq("status", "Cancelado"),
    supabase
      .from("mental_notes")
      .select("athlete_id, confidence_score")
      .in("athlete_id", athleteIds)
      .not("confidence_score", "is", null),
    supabase
      .from("athlete_swot_items")
      .select("athlete_id, status")
      .in("athlete_id", athleteIds)
      .in("category", ["Fraqueza", "Ameaça"]),
    supabase.from("athletes").select("id, position").in("id", athleteIds),
    supabase
      .from("game_lineups")
      .select("athlete_id, game_id, games(scheduled_date)")
      .in("athlete_id", athleteIds),
  ]);

  /** Agrupa as linhas por atleta uma única vez, em vez de filtrar por atleta. */
  function agrupar<T extends { athlete_id: string }>(linhas: T[] | null): Map<string, T[]> {
    const mapa = new Map<string, T[]>();
    for (const linha of linhas ?? []) {
      const atual = mapa.get(linha.athlete_id);
      if (atual) atual.push(linha);
      else mapa.set(linha.athlete_id, [linha]);
    }
    return mapa;
  }

  const eventosPor = agrupar(events);
  const exerciciosPor = agrupar(exercises);
  const encontrosPor = agrupar(meetings);
  const notasPor = agrupar(mentalNotes);
  const swotPor = agrupar(swotItems);
  const escalacoesPor = agrupar(lineups);
  const posicaoPor = new Map((athletes ?? []).map((a) => [a.id, a.position ?? []]));

  for (const athleteId of athleteIds) {
    const eventos = eventosPor.get(athleteId) ?? [];
    const count = (type: string) => eventos.filter((e) => e.event_type === type).length;
    const warnings: string[] = [];
    const hasEvents = eventos.length > 0;

    let attack = hasEvents
      ? clamp(
          50 +
            count("Gol") * 8 +
            count("Assistência") * 5 +
            count("Finalização certa") * 2 -
            count("Finalização errada") * 1,
        )
      : 50;

    const isAttacker = (posicaoPor.get(athleteId) ?? []).some((p) => ATTACKING_POSITIONS.includes(p));
    const recentGameIds = (escalacoesPor.get(athleteId) ?? [])
      .map((l) => ({
        gameId: l.game_id,
        date: (l.games as unknown as { scheduled_date: string } | null)?.scheduled_date,
      }))
      .filter((g) => g.date && g.date <= today)
      .sort((a, b) => (b.date as string).localeCompare(a.date as string))
      .slice(0, COLD_STREAK_GAMES)
      .map((g) => g.gameId);

    if (isAttacker && recentGameIds.length >= COLD_STREAK_MIN_GAMES) {
      const golsRecentes = eventos.filter(
        (e) => e.event_type === "Gol" && recentGameIds.includes(e.game_id),
      ).length;
      if (golsRecentes === 0) {
        attack = clamp(attack - COLD_STREAK_PENALTY);
        warnings.push(
          `⚠️ Sem gols nas últimas ${recentGameIds.length} partidas — finalização penalizada no ataque.`,
        );
      }
    }

    const defense = hasEvents
      ? clamp(50 + count("Desarme") * 5 + count("Interceptação") * 4 + count("Defesa") * 6)
      : 50;
    const discipline = hasEvents
      ? clamp(99 - (count("Cartão amarelo") * 8 + count("Cartão vermelho") * 20 + count("Falta") * 3))
      : 99;

    const exs = exerciciosPor.get(athleteId) ?? [];
    const physical = exs.length ? clamp(30 + (exs.filter((e) => e.done).length / exs.length) * 69) : 50;

    const confidencias = (notasPor.get(athleteId) ?? [])
      .map((m) => m.confidence_score)
      .filter((s): s is number => s != null);
    const mental = confidencias.length
      ? clamp((confidencias.reduce((a, b) => a + b, 0) / confidencias.length) * 9.9)
      : 50;

    const encontros = encontrosPor.get(athleteId) ?? [];
    const commitment = encontros.length
      ? clamp(30 + (encontros.filter((m) => m.athlete_confirmed).length / encontros.length) * 69)
      : 50;

    const swot = swotPor.get(athleteId) ?? [];
    const development = swot.length
      ? clamp(30 + (swot.filter((s) => s.status === "Concluído").length / swot.length) * 69)
      : 50;

    const overall = clamp(
      (attack + defense + discipline + physical + mental + commitment + development) / 7,
    );

    resultado.set(athleteId, {
      overall, attack, defense, discipline, physical, mental, commitment, development, warnings,
    });
  }

  return resultado;
}
