import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewAthleteModal } from "@/components/athletes/NewAthleteModal";
import { AthletesGrid } from "@/components/athletes/AthletesGrid";
import { getPartnerClubOptions } from "@/lib/data/partnerClubs";

export default async function AthletesPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, partnerClubs] = await Promise.all([
    supabase
      .from("athletes")
      .select(
        "id, full_name, team, category, position, instagram, joined_at, guardian_name, photo_color, photo_url, is_active",
      )
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    getPartnerClubOptions(supabase, profile!.clubId),
  ]);

  const athletesWithPhotos = await Promise.all(
    (athletes ?? []).map(async (a) => ({
      ...a,
      signedPhotoUrl: await resolveSignedUrl("athlete-photos", a.photo_url),
    })),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">
            Gestão de usuários
          </div>
          <h1 className="text-[28px] m-0">Atletas</h1>
        </div>
        <NewAthleteModal partnerClubs={partnerClubs} />
      </div>

      {!athletes || athletes.length === 0 ? (
        <Card>
          <EmptyState icon="👥" message="Nenhum atleta cadastrado ainda. Comece cadastrando o primeiro." />
        </Card>
      ) : (
        <AthletesGrid athletes={athletesWithPhotos} />
      )}
    </div>
  );
}
