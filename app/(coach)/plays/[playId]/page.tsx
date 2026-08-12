import { redirect } from "next/navigation";
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

  const [{ data: play }, { data: athletes }, { data: teamRows }] = await Promise.all([
    supabase.from("plays").select("*").eq("id", playId).single(),
    supabase
      .from("athletes")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("partner_clubs")
      .select("name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  if (!play) return null;

  // A lista não oferece "Editar" pra jogada padrão, mas a URL direta chegava
  // aqui. O treinador editava, salvava, via "sucesso" — e nada mudava: a
  // política de escrita casa por club_id, e jogada global não tem clube.
  // Melhor não abrir o editor do que prometer um salvamento que não ocorre.
  if (play.is_global) redirect("/plays");

  const teams = (teamRows ?? []).map((t) => t.name);
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
          sportType: play.sport_type,
          tags: play.tags ?? [],
          frames: frames.length > 0 ? frames : [defaultFrame()],
        }}
      />
    </div>
  );
}
