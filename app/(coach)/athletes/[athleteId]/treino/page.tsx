import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewExerciseModal } from "@/components/exercises/NewExerciseModal";

export default async function AthleteTreinoPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const supabase = await createClient();

  const [{ data: exercises }, { data: videos }, { data: openCycle }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, description, focus, done, video_url")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("exercise_videos")
      .select("id, exercise_id, label, status, coach_comment, submitted_at")
      .eq("athlete_id", athleteId),
    supabase
      .from("athlete_swot_cycles")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("status", "Aberto")
      .maybeSingle(),
  ]);

  const { data: openSwotItems } = openCycle
    ? await supabase
        .from("athlete_swot_items")
        .select("id, category, description")
        .eq("cycle_id", openCycle.id)
        .eq("status", "Aberto")
        .order("created_at", { ascending: true })
    : { data: null };

  const videosByExercise = new Map<string, typeof videos>();
  (videos ?? []).forEach((v) => {
    const list = videosByExercise.get(v.exercise_id) ?? [];
    list.push(v);
    videosByExercise.set(v.exercise_id, list);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-[18px] m-0">Exercícios de aprimoramento</h2>
          <div className="text-xs text-ink-faint mt-0.5">Foco nas deficiências identificadas</div>
        </div>
        <NewExerciseModal athleteId={athleteId} openSwotItems={openSwotItems ?? []} />
      </div>

      {!exercises || exercises.length === 0 ? (
        <Card>
          <EmptyState icon="🏋️" message="Nenhum exercício prescrito ainda." />
        </Card>
      ) : (
        exercises.map((ex) => {
          const exVideos = videosByExercise.get(ex.id) ?? [];
          const pending = exVideos.filter((v) => v!.status === "Pendente").length;
          return (
            <Card key={ex.id} className="mb-3">
              <div className="flex gap-3 items-start">
                <div
                  className={`w-[22px] h-[22px] rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    ex.done ? "bg-pitch-dark border-pitch-dark text-amber" : "border-line"
                  }`}
                >
                  {ex.done ? "✓" : ""}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <b className={`text-[14.5px] ${ex.done ? "line-through text-ink-faint" : ""}`}>
                      {ex.name}
                    </b>
                    {ex.focus && <Badge tone="sky">{ex.focus}</Badge>}
                    {pending > 0 && <Badge tone="amber">🎥 {pending} aguardando avaliação</Badge>}
                  </div>
                  <p className="text-[12.5px] text-ink-faint m-0">{ex.description}</p>
                  {ex.video_url && (
                    <a
                      href={ex.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex mt-2 text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                    >
                      ▶ Ver vídeo do treino
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line">
                {exVideos.length === 0 ? (
                  <p className="text-xs text-ink-faint m-0">
                    Nenhum vídeo enviado para este exercício ainda.
                  </p>
                ) : (
                  exVideos.map((v) => (
                    <div key={v!.id} className="flex items-center gap-3 py-2">
                      <div className="w-[52px] h-[38px] rounded-md bg-[#C1432B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        ▶ VID
                      </div>
                      <div className="flex-1 min-w-0">
                        <b className="text-[13px] block truncate">{v!.label}</b>
                        <span className="text-[11.5px] text-ink-faint">
                          {v!.submitted_at?.slice(0, 10)}
                          {v!.coach_comment ? ` · "${v!.coach_comment}"` : ""}
                        </span>
                      </div>
                      <Badge tone={v!.status === "Avaliado" ? "green" : "amber"}>{v!.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
