import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AthleteExerciseCard } from "@/components/exercises/AthleteExerciseCard";

export default async function AthleteTreinoPage() {
  const profile = await getSessionProfile();
  const athleteId = profile?.athleteId;

  if (!athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();
  const [{ data: exercises }, { data: videos }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, description, focus, done, video_url")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("exercise_videos")
      .select("id, exercise_id, label, status, coach_comment, submitted_at")
      .eq("athlete_id", athleteId),
  ]);

  const videosByExercise = new Map<string, NonNullable<typeof videos>>();
  (videos ?? []).forEach((v) => {
    const list = videosByExercise.get(v.exercise_id) ?? [];
    list.push(v);
    videosByExercise.set(v.exercise_id, list);
  });

  return (
    <div>
      <h2 className="text-[28px] mb-1">Meus exercícios</h2>
      <p className="text-xs text-ink-faint mb-5">
        Envie um vídeo de cada exercício para o treinador avaliar
      </p>

      {!exercises || exercises.length === 0 ? (
        <Card>
          <EmptyState icon="🏋️" message="Nenhum exercício prescrito ainda." />
        </Card>
      ) : (
        exercises.map((ex) => (
          <AthleteExerciseCard
            key={ex.id}
            exercise={ex}
            videos={videosByExercise.get(ex.id) ?? []}
            athleteId={athleteId}
            clubId={profile!.clubId}
          />
        ))
      )}
    </div>
  );
}
