import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PlayEditor } from "@/components/plays/PlayEditor";
import { defaultFrame, type PlayFrame } from "@/lib/types/plays";

export default async function EditPlayPage({
  params,
}: {
  params: Promise<{ playId: string }>;
}) {
  const { playId } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: play }, { data: athletes }] = await Promise.all([
    supabase.from("plays").select("*").eq("id", playId).single(),
    supabase
      .from("athletes")
      .select("id, full_name, team")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
  ]);

  if (!play) return null;

  const teams = Array.from(
    new Set((athletes ?? []).map((a) => a.team).filter((t): t is string => !!t)),
  );
  const frames = (play.frames as unknown as PlayFrame[]) ?? [];

  return (
    <div>
      <h2 className="text-[28px] mb-6">Editar jogada</h2>
      <PlayEditor
        editMode="edit"
        playId={play.id}
        athletes={athletes ?? []}
        teams={teams}
        initialPlay={{
          name: play.name,
          targetType: play.target_type,
          targetAthleteId: play.target_athlete_id,
          targetTeam: play.target_team,
          videoUrl: play.video_url,
          description: play.description,
          frames: frames.length > 0 ? frames : [defaultFrame()],
        }}
      />
    </div>
  );
}
