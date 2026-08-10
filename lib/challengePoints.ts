import "server-only";
import type { createClient } from "@/lib/supabase/server";

export async function getAthleteChallengePoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<number> {
  const { data } = await supabase
    .from("challenge_submissions")
    .select("points_awarded")
    .eq("athlete_id", athleteId)
    .eq("status", "Aprovado");
  return (data ?? []).reduce((sum, s) => sum + (s.points_awarded ?? 0), 0);
}
