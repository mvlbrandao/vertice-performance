import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computePlayerScore } from "@/lib/scoring";

/**
 * Dados de comparação pra ficha do atleta: um atleta só pode ler o próprio
 * registro via RLS, então essas funções usam o client admin pra calcular o
 * score de colegas/pares — mas só retornam números anônimos (sem id, nome ou
 * qualquer campo identificável), nunca uma linha individual de outro atleta.
 * Escopo "clube"/"sub" fica dentro do próprio tenant (mesma proteção que o
 * treinador já tem); escopo "sistema" atravessa clubes, por isso retorna só
 * o percentil do próprio atleta dentro da distribuição — nenhum ponto
 * individual de outro clube é exposto.
 */

export async function getClubPeerCloud(
  clubId: string,
  excludeAthleteId: string,
  category?: string | null,
): Promise<{ x: number; y: number }[]> {
  const admin = createAdminClient();
  let query = admin
    .from("athletes")
    .select("id")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .neq("id", excludeAthleteId);
  if (category) query = query.eq("category", category);

  const { data: athletes } = await query;
  if (!athletes || athletes.length === 0) return [];

  const scores = await Promise.all(
    athletes.map((a) => computePlayerScore(admin, a.id)),
  );
  return scores.map((s) => ({ x: s.attack, y: s.defense }));
}

function percentileRank(value: number, values: number[]) {
  if (values.length === 0) return 50;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}

export async function getSystemPercentile(
  athleteId: string,
  category: string | null,
): Promise<{ attackPercentile: number; defensePercentile: number; sampleSize: number } | null> {
  if (!category) return null;
  const admin = createAdminClient();
  const { data: athletes } = await admin
    .from("athletes")
    .select("id")
    .eq("category", category)
    .eq("is_active", true);
  if (!athletes || athletes.length < 5) return null;

  const scores = await Promise.all(athletes.map((a) => computePlayerScore(admin, a.id)));
  const mine = scores.find((_, i) => athletes[i].id === athleteId);
  if (!mine) return null;

  return {
    attackPercentile: percentileRank(
      mine.attack,
      scores.map((s) => s.attack),
    ),
    defensePercentile: percentileRank(
      mine.defense,
      scores.map((s) => s.defense),
    ),
    sampleSize: athletes.length,
  };
}
