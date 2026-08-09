import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { OpenCycleButton } from "@/components/anamnese/OpenCycleButton";
import { CloseCycleButton } from "@/components/anamnese/CloseCycleButton";
import { NewSwotItemModal } from "@/components/anamnese/NewSwotItemModal";
import { SwotItemCard } from "@/components/anamnese/SwotItemCard";
import { SWOT_CATEGORIES, SWOT_CATEGORY_META } from "@/lib/types/swot";

export default async function AthleteAnamnesePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("athletes")
    .select("position")
    .eq("id", athleteId)
    .single();

  const { data: cycles } = await supabase
    .from("athlete_swot_cycles")
    .select("id, cycle_number, status, opened_at, closed_at")
    .eq("athlete_id", athleteId)
    .order("cycle_number", { ascending: false });

  const openCycle = cycles?.find((c) => c.status === "Aberto") ?? null;
  const closedCycles = (cycles ?? []).filter((c) => c.status === "Fechado");

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
          <h3 className="text-[19px] m-0">Anamnese — Análise SWOT</h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Plano de evolução do atleta: força, fraqueza, oportunidade e ameaça, cada ponto com
            meta de encontros e treinos até a próxima reavaliação.
          </div>
        </div>
        {openCycle && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="dark">Ciclo {openCycle.cycle_number}</Badge>
            <CloseCycleButton cycleId={openCycle.id} athleteId={athleteId} />
          </div>
        )}
      </div>

      {!openCycle ? (
        <Card>
          <EmptyState
            icon="🧭"
            message="Nenhuma análise SWOT em aberto. Inicie a primeira pra montar o plano de evolução."
          />
          <div className="flex justify-center mt-3">
            <OpenCycleButton athleteId={athleteId} label="Iniciar análise SWOT" />
          </div>
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
                    athleteId={athleteId}
                    category={category}
                    showTargets
                    positions={athlete?.position}
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
                        athleteId={athleteId}
                        description={it.description}
                        authorRole={it.author_role}
                        status={it.status}
                        targetMeetings={it.target_meetings}
                        targetTrainings={it.target_trainings}
                        meetingsDone={it.meetings_done}
                        trainingsDone={it.trainings_done}
                        canManage
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {closedCycles.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">
            Histórico de ciclos
          </div>
          <div className="flex flex-col gap-1.5">
            {closedCycles.map((c) => (
              <div
                key={c.id}
                className="text-xs text-ink-soft border border-line rounded-sm px-3 py-2"
              >
                Ciclo {c.cycle_number} · {c.opened_at?.slice(0, 10)} até{" "}
                {c.closed_at?.slice(0, 10)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
