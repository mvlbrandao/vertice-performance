import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ScoreSnapshotPoint } from "@/components/athletes/ScoreHistoryChart";

/**
 * Série histórica do score pra desenhar a curva. Fica em ordem cronológica
 * (o mais antigo primeiro) porque é assim que o gráfico lê os pontos.
 */
export async function getScoreHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  limit = 30,
): Promise<ScoreSnapshotPoint[]> {
  const { data } = await supabase
    .from("athlete_score_snapshots")
    .select(
      "computed_at, overall, attack, defense, physical, mental, discipline, commitment, development",
    )
    .eq("athlete_id", athleteId)
    .order("computed_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .map((s) => ({
      date: s.computed_at.slice(0, 10),
      overall: s.overall,
      attack: s.attack,
      defense: s.defense,
      physical: s.physical,
      mental: s.mental,
      discipline: s.discipline,
      commitment: s.commitment,
      development: s.development,
    }))
    .reverse();
}
