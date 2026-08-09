import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewSwotItemModal } from "@/components/anamnese/NewSwotItemModal";
import { SwotItemCard } from "@/components/anamnese/SwotItemCard";
import { SWOT_CATEGORIES, SWOT_CATEGORY_META } from "@/lib/types/swot";

export default async function AthleteAnamnesePage() {
  const profile = await getSessionProfile();

  if (!profile?.athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: cycles } = await supabase
    .from("athlete_swot_cycles")
    .select("id, cycle_number, status")
    .eq("athlete_id", profile.athleteId)
    .order("cycle_number", { ascending: false });

  const openCycle = cycles?.find((c) => c.status === "Aberto") ?? null;

  const { data: items } = openCycle
    ? await supabase
        .from("athlete_swot_items")
        .select("*")
        .eq("cycle_id", openCycle.id)
        .order("created_at", { ascending: true })
    : { data: null };

  const itemsByCategory = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) {
    const list = itemsByCategory.get(it.category) ?? [];
    list.push(it);
    itemsByCategory.set(it.category, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-[28px] m-0">Minha anamnese</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Sua autoavaliação SWOT, junto com a análise do seu treinador. Registre seus pontos —
            as metas de encontro e treino ficam a cargo do treinador.
          </div>
        </div>
        {openCycle && <Badge tone="dark">Ciclo {openCycle.cycle_number}</Badge>}
      </div>

      {!openCycle ? (
        <Card>
          <EmptyState
            icon="🧭"
            message="Nenhuma análise SWOT em aberto ainda. Peça ao seu treinador pra iniciar."
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3.5">
          {SWOT_CATEGORIES.map((category) => {
            const meta = SWOT_CATEGORY_META[category];
            const categoryItems = itemsByCategory.get(category) ?? [];
            return (
              <Card key={category}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span>{meta.icon}</span>
                    <b className="text-sm">{category}</b>
                  </div>
                  <NewSwotItemModal
                    cycleId={openCycle.id}
                    athleteId={profile.athleteId!}
                    category={category}
                    showTargets={false}
                  />
                </div>
                {categoryItems.length === 0 ? (
                  <p className="text-xs text-ink-faint m-0">Nenhum ponto registrado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {categoryItems.map((it) => (
                      <SwotItemCard
                        key={it.id}
                        id={it.id}
                        athleteId={profile.athleteId!}
                        description={it.description}
                        authorRole={it.author_role}
                        status={it.status}
                        targetMeetings={it.target_meetings}
                        targetTrainings={it.target_trainings}
                        meetingsDone={it.meetings_done}
                        trainingsDone={it.trainings_done}
                        canManage={false}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
