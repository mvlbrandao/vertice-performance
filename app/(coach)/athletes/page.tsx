import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewAthleteModal } from "@/components/athletes/NewAthleteModal";
import { initials } from "@/lib/utils/initials";
import { getPartnerClubOptions } from "@/lib/data/partnerClubs";

export default async function AthletesPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, partnerClubs] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, full_name, team, category, position, instagram, joined_at, guardian_name, photo_color, photo_url")
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletesWithPhotos.map((a) => (
            <Link key={a.id} href={`/athletes/${a.id}/dados`}>
              <Card shadow className="h-full cursor-pointer hover:border-pitch-dark transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  {a.signedPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.signedPhotoUrl}
                      alt={a.full_name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center font-display text-lg shrink-0"
                      style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                    >
                      {initials(a.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <b className="block text-base truncate">{a.full_name}</b>
                    <span className="text-xs text-ink-faint truncate block">
                      {a.team ?? "—"}
                      {a.instagram ? ` · ${a.instagram}` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-2.5">
                  {a.category && <Badge tone="green">{a.category}</Badge>}
                  {a.position && <Badge tone="amber">{a.position}</Badge>}
                </div>
                <p className="text-[12.5px] text-ink-soft m-0">
                  {a.joined_at ? `Ingressou em ${a.joined_at}` : ""}
                  {a.guardian_name ? ` · Responsável: ${a.guardian_name}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
