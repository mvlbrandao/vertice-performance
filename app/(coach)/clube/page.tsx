import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { initials } from "@/lib/utils/initials";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewPartnerClubModal } from "@/components/partnerClubs/NewPartnerClubModal";
import { DeletePartnerClubButton } from "@/components/partnerClubs/DeletePartnerClubButton";
import { NewPartnerClubCategoryModal } from "@/components/partnerClubs/NewPartnerClubCategoryModal";
import { DeletePartnerClubCategoryButton } from "@/components/partnerClubs/DeletePartnerClubCategoryButton";
import { EditPartnerClubColorsModal } from "@/components/partnerClubs/EditPartnerClubColorsModal";
import { SubStaffModal } from "@/components/partnerClubs/SubStaffModal";
import { ManagedToggle } from "@/components/partnerClubs/ManagedToggle";

export default async function ClubPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [
    { data: club },
    { data: partnerClubs },
    { data: categories },
    { data: athletes },
    { data: staffProfiles },
    { data: subAssignments },
  ] = await Promise.all([
    supabase.from("clubs").select("name, created_at").eq("id", profile!.clubId).single(),
    supabase
      .from("partner_clubs")
      .select("id, name, color_1, color_2, color_3, is_managed")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
    supabase
      .from("partner_club_categories")
      .select("id, name, partner_club_id")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
    supabase
      .from("athletes")
      .select("id, full_name, team, category, photo_url, photo_color")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, title")
      .eq("club_id", profile!.clubId)
      .eq("role", "staff")
      .order("full_name", { ascending: true }),
    supabase
      .from("sub_staff_assignments")
      .select("partner_club_category_id, staff_profile_id, role_title, profiles!staff_profile_id(full_name)")
      .eq("club_id", profile!.clubId),
  ]);

  const categoriesByClub = new Map<string, { id: string; name: string }[]>();
  for (const c of categories ?? []) {
    const list = categoriesByClub.get(c.partner_club_id) ?? [];
    list.push({ id: c.id, name: c.name });
    categoriesByClub.set(c.partner_club_id, list);
  }

  const assignmentsByCategory = new Map<
    string,
    { staffProfileId: string; roleTitle: string; staffName: string }[]
  >();
  for (const a of subAssignments ?? []) {
    const list = assignmentsByCategory.get(a.partner_club_category_id) ?? [];
    list.push({
      staffProfileId: a.staff_profile_id,
      roleTitle: a.role_title,
      staffName: (a.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
    });
    assignmentsByCategory.set(a.partner_club_category_id, list);
  }

  const athletesWithPhotos = await Promise.all(
    (athletes ?? []).map(async (a) => ({
      ...a,
      signedPhotoUrl: await resolveSignedUrl("athlete-photos", a.photo_url),
    })),
  );
  const athletesByClub = new Map<string, typeof athletesWithPhotos>();
  for (const a of athletesWithPhotos) {
    if (!a.team) continue;
    const list = athletesByClub.get(a.team) ?? [];
    list.push(a);
    athletesByClub.set(a.team, list);
  }

  return (
    <div>
      <h2 className="text-[28px] m-0 mb-1">{club?.name ?? "Clube"}</h2>
      <div className="text-xs text-ink-faint mb-6">
        No sistema desde {club?.created_at ? new Date(club.created_at).toLocaleDateString("pt-BR") : "—"}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div>
            <h3 className="m-0">Clubes & subs</h3>
            <div className="text-xs text-ink-faint mt-0.5">
              Cadastro dos clubes de origem dos atletas, cada um com seus subs (categorias) por
              dentro. Alimenta os campos &quot;Time&quot; e &quot;Categoria&quot; no cadastro de
              atleta.
            </div>
          </div>
          <NewPartnerClubModal />
        </div>

        {!partnerClubs || partnerClubs.length === 0 ? (
          <EmptyState icon="🏟️" message="Nenhum clube cadastrado ainda." />
        ) : (
          <div className="flex flex-col gap-3">
            {partnerClubs.map((pc) => {
              const clubCategories = categoriesByClub.get(pc.id) ?? [];
              const clubAthletes = athletesByClub.get(pc.name) ?? [];
              return (
                <div key={pc.id} className="border border-line rounded-md p-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-sm">{pc.name}</b>
                      <ManagedToggle partnerClubId={pc.id} isManaged={pc.is_managed} />
                      <EditPartnerClubColorsModal
                        partnerClubId={pc.id}
                        clubName={pc.name}
                        color1={pc.color_1}
                        color2={pc.color_2}
                        color3={pc.color_3}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NewPartnerClubCategoryModal partnerClubId={pc.id} clubName={pc.name} />
                      <DeletePartnerClubButton partnerClubId={pc.id} />
                    </div>
                  </div>
                  {clubCategories.length === 0 ? (
                    <p className="text-xs text-ink-faint m-0">Nenhum sub cadastrado.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {clubCategories.map((c) => {
                        const staffHere = assignmentsByCategory.get(c.id) ?? [];
                        return (
                          <div
                            key={c.id}
                            className="border border-line rounded-sm px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold bg-chalk rounded-full px-2.5 py-0.5">
                                {c.name}
                              </span>
                              <DeletePartnerClubCategoryButton categoryId={c.id} />
                              <SubStaffModal
                                categoryId={c.id}
                                categoryName={`${pc.name} · ${c.name}`}
                                staffList={staffProfiles ?? []}
                                assignments={staffHere}
                              />
                            </div>
                            {staffHere.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {staffHere.map((a) => (
                                  <Badge key={a.staffProfileId} tone="amber">
                                    {a.roleTitle}: {a.staffName}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide mb-2">
                      Atletas · {clubAthletes.length}
                    </div>
                    {clubAthletes.length === 0 ? (
                      <p className="text-xs text-ink-faint m-0">Nenhum atleta neste clube.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {clubAthletes.map((a) => (
                          <Link
                            key={a.id}
                            href={`/athletes/${a.id}/dados`}
                            className="flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-chalk"
                          >
                            {a.signedPhotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.signedPhotoUrl}
                                alt={a.full_name}
                                className="w-6 h-6 rounded-md object-cover shrink-0"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center font-display text-[10px] shrink-0"
                                style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                              >
                                {initials(a.full_name)}
                              </div>
                            )}
                            <span className="text-xs font-semibold truncate flex-1 min-w-0">
                              {a.full_name}
                            </span>
                            {a.category && (
                              <span className="text-[11px] text-ink-faint shrink-0">
                                · {a.category}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
