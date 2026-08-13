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
