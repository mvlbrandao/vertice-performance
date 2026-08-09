import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewCategoryModal } from "@/components/categories/NewCategoryModal";
import { DeleteCategoryButton } from "@/components/categories/DeleteCategoryButton";
import { NewTeamModal } from "@/components/teams/NewTeamModal";
import { DeleteTeamButton } from "@/components/teams/DeleteTeamButton";
import { EditClubNameModal } from "@/components/clubs/EditClubNameModal";

export default async function ClubPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: club }, { data: categories }, { data: teams }] = await Promise.all([
    supabase.from("clubs").select("name, created_at").eq("id", profile!.clubId).single(),
    supabase
      .from("categories")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
        <h2 className="text-[28px] m-0">{club?.name ?? "Clube"}</h2>
        <EditClubNameModal currentName={club?.name ?? ""} />
      </div>
      <div className="text-xs text-ink-faint mb-6">
        No sistema desde {club?.created_at ? new Date(club.created_at).toLocaleDateString("pt-BR") : "—"}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="m-0">Categorias (subs)</h3>
              <div className="text-xs text-ink-faint mt-0.5">
                Ex: Sub-9, Sub-11, Sub-13. Usado no cadastro de atletas e nas jogadas da Mesa
                Tática.
              </div>
            </div>
            <NewCategoryModal />
          </div>

          {!categories || categories.length === 0 ? (
            <EmptyState icon="🏷️" message="Nenhuma categoria cadastrada ainda." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 bg-chalk border border-line rounded-full pl-3 pr-1.5 py-1"
                >
                  <span className="text-[13px] font-semibold">{c.name}</span>
                  <DeleteCategoryButton categoryId={c.id} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="m-0">Times / turmas</h3>
              <div className="text-xs text-ink-faint mt-0.5">
                Ex: Sub-12 A, Sub-12 B. Usado no campo &quot;Time&quot; do cadastro de atletas.
              </div>
            </div>
            <NewTeamModal />
          </div>

          {!teams || teams.length === 0 ? (
            <EmptyState icon="👕" message="Nenhum time cadastrado ainda." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 bg-chalk border border-line rounded-full pl-3 pr-1.5 py-1"
                >
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  <DeleteTeamButton teamId={t.id} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
