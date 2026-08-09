import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewCategoryModal } from "@/components/categories/NewCategoryModal";
import { DeleteCategoryButton } from "@/components/categories/DeleteCategoryButton";

export default async function ClubPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: club }, { data: categories }] = await Promise.all([
    supabase.from("clubs").select("name, created_at").eq("id", profile!.clubId).single(),
    supabase
      .from("categories")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <h2 className="text-[28px] mb-1">{club?.name ?? "Clube"}</h2>
      <div className="text-xs text-ink-faint mb-6">
        No sistema desde {club?.created_at ? new Date(club.created_at).toLocaleDateString("pt-BR") : "—"}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="m-0">Categorias (subs)</h3>
            <div className="text-xs text-ink-faint mt-0.5">
              Cadastro organizado das categorias de base do clube, para usar no cadastro de
              atletas e nas jogadas da Mesa Tática.
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
    </div>
  );
}
