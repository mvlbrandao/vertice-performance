import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckinForm } from "@/components/checkins/CheckinForm";

export default async function AthleteCheckinPage() {
  const profile = await getSessionProfile();
  const athleteId = profile?.athleteId;

  if (!athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: checkins } = await supabase
    .from("checkins")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("checkin_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-[28px] m-0">Check-in diário</h2>
        <CheckinForm />
      </div>
      <Card>
        {!checkins || checkins.length === 0 ? (
          <EmptyState icon="✅" message="Você ainda não registrou nenhum check-in." />
        ) : (
          checkins.map((c) => (
            <div key={c.id} className="flex items-center gap-3.5 py-3 border-b border-line last:border-b-0">
              <div className="w-11 h-11 rounded-lg bg-chalk flex items-center justify-center font-display text-base shrink-0">
                {c.fatigue_level}/5
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold m-0">{c.checkin_date}</h4>
                <p className="text-xs text-ink-faint m-0">Dor relatada: {c.pain_notes || "Nenhuma"}</p>
              </div>
              <Badge tone={c.training_done ? "green" : "clay"}>
                {c.training_done ? "Treino ✓" : "Treino ✗"}
              </Badge>
              <Badge tone={c.diet_done ? "green" : "clay"}>
                {c.diet_done ? "Dieta ✓" : "Dieta ✗"}
              </Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
