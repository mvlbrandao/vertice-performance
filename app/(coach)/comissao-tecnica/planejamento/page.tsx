import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { computePlayerScores, type PlayerScore } from "@/lib/scoring";
import { resolveSignedUrls } from "@/lib/storage/resolveSignedUrl";
import { PlanningBoard, type PlanningAthlete, type PlanningColumn } from "@/components/scouting/PlanningBoard";

const SCORE_PADRAO: PlayerScore = {
  overall: 50,
  attack: 50,
  defense: 50,
  discipline: 50,
  physical: 50,
  mental: 50,
  commitment: 50,
  development: 50,
  warnings: [],
};

export default async function PlanejamentoPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, { data: columns }, { data: stages }] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, full_name, category, position, photo_url, photo_color")
      .eq("club_id", profile!.clubId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("planning_columns")
      .select("id, name, position, color")
      .eq("club_id", profile!.clubId)
      .order("position", { ascending: true }),
    supabase
      .from("athlete_planning_stage")
      .select("athlete_id, column_id, note, moved_at")
      .eq("club_id", profile!.clubId),
  ]);

  // Score em lote (uma chamada pra todo mundo) e fotos assinadas em lote —
  // mesma lição do gráfico de dispersão: uma consulta por atleta não escala.
  const [scores, signedPhotos] = await Promise.all([
    computePlayerScores(supabase, (athletes ?? []).map((a) => a.id)),
    resolveSignedUrls("athlete-photos", (athletes ?? []).map((a) => a.photo_url)),
  ]);
  const stageByAthlete = new Map((stages ?? []).map((s) => [s.athlete_id, s]));

  const planningAthletes: PlanningAthlete[] = (athletes ?? []).map((a) => {
    const stage = stageByAthlete.get(a.id);
    return {
      id: a.id,
      fullName: a.full_name,
      category: a.category,
      position: a.position?.join(", ") || null,
      photoUrl: a.photo_url ? signedPhotos.get(a.photo_url) ?? null : null,
      photoColor: a.photo_color,
      score: scores.get(a.id) ?? SCORE_PADRAO,
      columnId: stage?.column_id ?? null,
      note: stage?.note ?? null,
      movedAt: stage?.moved_at ?? null,
    };
  });

  const planningColumns: PlanningColumn[] = (columns ?? []) as PlanningColumn[];

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">Comissão Técnica</div>
        <h1 className="text-[28px] m-0">Planejamento</h1>
        <p className="text-sm text-ink-faint mt-1 max-w-[64ch]">
          Arraste cada atleta pela etapa de evolução dele. As colunas são as suas — renomeie, crie
          ou remova como fizer sentido pro seu método.
        </p>
      </div>

      {planningAthletes.length === 0 ? (
        <Card>
          <EmptyState icon="🗂️" message="Nenhum atleta ativo cadastrado ainda." />
        </Card>
      ) : (
        <PlanningBoard athletes={planningAthletes} columns={planningColumns} />
      )}
    </div>
  );
}
