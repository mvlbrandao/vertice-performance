import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewPartnerClubModal } from "@/components/partnerClubs/NewPartnerClubModal";
import { DeletePartnerClubButton } from "@/components/partnerClubs/DeletePartnerClubButton";
import { NewPartnerClubCategoryModal } from "@/components/partnerClubs/NewPartnerClubCategoryModal";
import { DeletePartnerClubCategoryButton } from "@/components/partnerClubs/DeletePartnerClubCategoryButton";

export default async function ClubPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: club }, { data: partnerClubs }, { data: categories }] = await Promise.all([
    supabase.from("clubs").select("name, created_at").eq("id", profile!.clubId).single(),
    supabase
      .from("partner_clubs")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
    supabase
      .from("partner_club_categories")
      .select("id, name, partner_club_id")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  const categoriesByClub = new Map<string, { id: string; name: string }[]>();
  for (const c of categories ?? []) {
    const list = categoriesByClub.get(c.partner_club_id) ?? [];
    list.push({ id: c.id, name: c.name });
    categoriesByClub.set(c.partner_club_id, list);
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
              return (
                <div key={pc.id} className="border border-line rounded-md p-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                    <b className="text-sm">{pc.name}</b>
                    <div className="flex items-center gap-1.5">
                      <NewPartnerClubCategoryModal partnerClubId={pc.id} clubName={pc.name} />
                      <DeletePartnerClubButton partnerClubId={pc.id} />
                    </div>
                  </div>
                  {clubCategories.length === 0 ? (
                    <p className="text-xs text-ink-faint m-0">Nenhum sub cadastrado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {clubCategories.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-1.5 bg-chalk border border-line rounded-full pl-2.5 pr-2 py-0.5"
                        >
                          <span className="text-xs font-semibold">{c.name}</span>
                          <DeletePartnerClubCategoryButton categoryId={c.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
