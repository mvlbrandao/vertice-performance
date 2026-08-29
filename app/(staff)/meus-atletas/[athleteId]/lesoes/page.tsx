import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewInjuryModal } from "@/components/injuries/NewInjuryModal";
import { InjuryCard } from "@/components/injuries/InjuryCard";

export default async function StaffAthleteLesoesPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const staff = await requireStaff();
  const supabase = await createClient();

  const [{ data: injuries }, { data: games }, { data: grant }] = await Promise.all([
    supabase
      .from("athlete_injuries")
      .select(
        "id, athlete_id, source, body_region, injury_type, severity, description, occurred_at, expected_return_date, status, treatment_notes, games(opponent, scheduled_date)",
      )
      .eq("athlete_id", athleteId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("games")
      .select("id, opponent, scheduled_date")
      .eq("club_id", staff.clubId)
      .order("scheduled_date", { ascending: false })
      .limit(40),
    supabase
      .from("athlete_staff_access")
      .select("access_level")
      .eq("athlete_id", athleteId)
      .eq("staff_profile_id", staff.userId)
      .maybeSingle(),
  ]);
  const canManage = grant?.access_level === "manage";

  const activeCount = (injuries ?? []).filter((i) => i.status !== "Recuperado").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div>
          <h2 className="text-[18px] m-0">Lesões</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? "lesão ativa" : "lesões ativas"}`
              : "Nenhuma lesão em aberto"}
          </div>
        </div>
        {canManage && <NewInjuryModal athleteId={athleteId} games={games ?? []} />}
      </div>

      {!injuries || injuries.length === 0 ? (
        <Card>
          <EmptyState icon="🩹" message="Nenhuma lesão registrada ainda." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {injuries.map((i) => (
            <InjuryCard
              key={i.id}
              injury={{
                id: i.id,
                athlete_id: i.athlete_id,
                source: i.source,
                body_region: i.body_region,
                injury_type: i.injury_type,
                severity: i.severity,
                description: i.description,
                occurred_at: i.occurred_at,
                expected_return_date: i.expected_return_date,
                status: i.status,
                treatment_notes: i.treatment_notes,
                game: i.games as unknown as { opponent: string; scheduled_date: string } | null,
              }}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
