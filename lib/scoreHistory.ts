import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { PlayerScore } from "@/lib/scoring";

export interface ScoreChange {
  direction: "up" | "down";
  previousOverall: number;
  currentOverall: number;
  changedAttributes: { label: string; from: number; to: number }[];
}

export interface ScoreChangeResult {
  snapshotId: string;
  change: ScoreChange;
}

const ATTRIBUTE_LABELS: { key: keyof Omit<PlayerScore, "overall" | "warnings">; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defesa" },
  { key: "physical", label: "Físico" },
  { key: "mental", label: "Mental" },
  { key: "discipline", label: "Disciplina" },
  { key: "commitment", label: "Compromisso" },
  { key: "development", label: "Desenvolvimento" },
];

type SnapshotRow = {
  overall: number;
  attack: number;
  defense: number;
  discipline: number;
  physical: number;
  mental: number;
  commitment: number;
  development: number;
};

function buildChange(previous: SnapshotRow, current: SnapshotRow): ScoreChange | null {
  if (previous.overall === current.overall) return null;
  const changedAttributes = ATTRIBUTE_LABELS.filter((a) => previous[a.key] !== current[a.key]).map(
    (a) => ({ label: a.label, from: previous[a.key], to: current[a.key] }),
  );
  return {
    direction: current.overall > previous.overall ? "up" : "down",
    previousOverall: previous.overall,
    currentOverall: current.overall,
    changedAttributes,
  };
}

/**
 * Registra um novo snapshot quando o score muda (não duplica se o
 * último já bate com o atual), e devolve o alerta pendente mais antigo
 * ainda não reconhecido, se houver — sem marcá-lo como visto. Quem
 * chama isso é responsável por, depois de exibir o alerta pro usuário,
 * chamar acknowledgeScoreSnapshot. Assim o alerta sobrevive a
 * múltiplas renderizações de servidor da mesma navegação (comum
 * depois de router.refresh()) em vez de ser consumido antes de
 * chegar na tela.
 */
export async function getScoreChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  athleteId: string,
  score: PlayerScore,
): Promise<ScoreChangeResult | null> {
  const { data: last } = await supabase
    .from("athlete_score_snapshots")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) {
    await supabase.from("athlete_score_snapshots").insert({
      club_id: clubId,
      athlete_id: athleteId,
      overall: score.overall,
      attack: score.attack,
      defense: score.defense,
      discipline: score.discipline,
      physical: score.physical,
      mental: score.mental,
      commitment: score.commitment,
      development: score.development,
      acknowledged: true,
    });
    return null;
  }

  if (last.overall !== score.overall) {
    await supabase.from("athlete_score_snapshots").insert({
      club_id: clubId,
      athlete_id: athleteId,
      overall: score.overall,
      attack: score.attack,
      defense: score.defense,
      discipline: score.discipline,
      physical: score.physical,
      mental: score.mental,
      commitment: score.commitment,
      development: score.development,
      acknowledged: false,
    });
  }

  const { data: pending } = await supabase
    .from("athlete_score_snapshots")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("acknowledged", false)
    .order("computed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pending) return null;

  const { data: previous } = await supabase
    .from("athlete_score_snapshots")
    .select("*")
    .eq("athlete_id", athleteId)
    .lt("computed_at", pending.computed_at)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!previous) return null;

  const change = buildChange(previous, pending);
  if (!change) return null;

  return { snapshotId: pending.id, change };
}
