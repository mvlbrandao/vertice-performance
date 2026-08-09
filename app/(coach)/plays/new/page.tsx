import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PlayEditor } from "@/components/plays/PlayEditor";

export default async function NewPlayPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, { data: teamRows }] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("teams")
      .select("name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);
  const teams = (teamRows ?? []).map((t) => t.name);

  return (
    <div>
      <h2 className="text-[28px] mb-6">Nova jogada</h2>
      <PlayEditor editMode="create" athletes={athletes ?? []} teams={teams} />
    </div>
  );
}
