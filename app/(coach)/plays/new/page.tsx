import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PlayEditor } from "@/components/plays/PlayEditor";

export default async function NewPlayPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, full_name, team")
    .eq("club_id", profile!.clubId)
    .order("full_name", { ascending: true });

  const teams = Array.from(
    new Set((athletes ?? []).map((a) => a.team).filter((t): t is string => !!t)),
  );

  return (
    <div>
      <h2 className="text-[28px] mb-6">Nova jogada</h2>
      <PlayEditor editMode="create" athletes={athletes ?? []} teams={teams} />
    </div>
  );
}
