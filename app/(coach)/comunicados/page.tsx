import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewAnnouncementModal } from "@/components/announcements/NewAnnouncementModal";
import { DeleteAnnouncementButton } from "@/components/announcements/DeleteAnnouncementButton";
import { getPartnerClubOptions } from "@/lib/data/partnerClubs";

export default async function ComunicadosPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: announcements }, partnerClubs, { data: athletes }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, target_team, target_category, created_at")
      .eq("club_id", profile!.clubId)
      .order("created_at", { ascending: false }),
    getPartnerClubOptions(supabase, profile!.clubId),
    supabase
      .from("athletes")
      .select("category")
      .eq("club_id", profile!.clubId)
      .eq("is_active", true),
  ]);

  const teams = partnerClubs.map((c) => c.name);
  const categories = Array.from(
    new Set((athletes ?? []).map((a) => a.category).filter(Boolean)),
  ).sort() as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-[28px] m-0">Mural de avisos</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Comunicados pro time inteiro, por categoria ou por time específico
          </div>
        </div>
        <NewAnnouncementModal teams={teams} categories={categories} />
      </div>

      <Card>
        {!announcements || announcements.length === 0 ? (
          <EmptyState icon="📣" message="Nenhum aviso publicado ainda." />
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3.5 py-3 border-b border-line last:border-b-0 flex-wrap"
            >
              <div className="flex-1 min-w-[200px]">
                <h4 className="text-sm font-semibold m-0">{a.title}</h4>
                <p className="text-[12.5px] text-ink-soft mt-1 mb-1.5 whitespace-pre-wrap">
                  {a.body}
                </p>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <span className="text-xs text-ink-faint">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  {a.target_team && <Badge tone="sky">{a.target_team}</Badge>}
                  {a.target_category && <Badge tone="amber">{a.target_category}</Badge>}
                  {!a.target_team && !a.target_category && <Badge tone="dark">Todos</Badge>}
                </div>
              </div>
              <DeleteAnnouncementButton announcementId={a.id} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
