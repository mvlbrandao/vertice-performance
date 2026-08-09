import "server-only";
import type { createClient } from "@/lib/supabase/server";

export interface PlayerScore {
  overall: number;
  attack: number;
  defense: number;
  discipline: number;
  physical: number;
  mental: number;
  commitment: number;
}

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
 *
 * Categoria sem nenhum dado ainda fica em 50 (neutro) pra não penalizar um
 * atleta recém-cadastrado.
 */
export async function computePlayerScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<PlayerScore> {
  const [{ data: events }, { data: exercises }, { data: meetings }, { data: mentalNotes }] =
    await Promise.all([
      supabase
        .from("game_events")
        .select("event_type")
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
    ]);

  const count = (type: string) => (events ?? []).filter((e) => e.event_type === type).length;

  const hasEvents = (events ?? []).length > 0;
  const attack = hasEvents
    ? clamp(
        50 +
          count("Gol") * 8 +
          count("Assistência") * 5 +
          count("Finalização certa") * 2 -
          count("Finalização errada") * 1,
      )
    : 50;
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

  const overall = clamp((attack + defense + discipline + physical + mental + commitment) / 6);

  return { overall, attack, defense, discipline, physical, mental, commitment };
}
