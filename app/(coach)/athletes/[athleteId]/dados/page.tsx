import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { InviteAthleteModal } from "@/components/athletes/InviteAthleteModal";
import { EditAthleteModal } from "@/components/athletes/EditAthleteModal";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-line text-[13.5px] last:border-b-0">
      <span className="text-ink-faint">{k}</span>
      <b>{v}</b>
    </div>
  );
}

function BarRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-[120px] text-[12.5px] font-semibold text-ink-soft shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-deep to-amber"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs text-ink-soft">{pct}%</span>
    </div>
  );
}

export default async function AthleteDadosPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const supabase = await createClient();

  const [{ data: athlete }, { data: checkins }, { data: existingProfile }] = await Promise.all([
    supabase.from("athletes").select("*").eq("id", athleteId).single(),
    supabase
      .from("checkins")
      .select("training_done, diet_done")
      .eq("athlete_id", athleteId),
    supabase.from("profiles").select("id").eq("athlete_id", athleteId).maybeSingle(),
  ]);

  if (!athlete) return null;

  const totalCheckins = checkins?.length ?? 0;
  const trainingPct = totalCheckins
    ? Math.round((checkins!.filter((c) => c.training_done).length / totalCheckins) * 100)
    : 0;
  const dietPct = totalCheckins
    ? Math.round((checkins!.filter((c) => c.diet_done).length / totalCheckins) * 100)
    : 0;

  const hasPain = athlete.current_pain && athlete.current_pain !== "Nenhuma";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="m-0">Dados pessoais</h3>
          <div className="flex items-center gap-2">
            <EditAthleteModal
              athleteId={athlete.id}
              athlete={{
                fullName: athlete.full_name,
                birthDate: athlete.birth_date,
                category: athlete.category,
                position: athlete.position,
                team: athlete.team,
                guardianName: athlete.guardian_name,
                guardianPhone: athlete.guardian_phone,
                athletePhone: athlete.athlete_phone,
                instagram: athlete.instagram,
                heightCm: athlete.height_cm,
                weightKg: athlete.weight_kg,
              }}
            />
            <InviteAthleteModal
              athleteId={athlete.id}
              fullName={athlete.full_name}
              alreadyProvisioned={!!existingProfile}
            />
          </div>
        </div>
        <Row k="Nascimento" v={athlete.birth_date ?? "—"} />
        <Row k="Responsável" v={athlete.guardian_name ?? "—"} />
        <Row k="Cel. do responsável" v={athlete.guardian_phone ?? "—"} />
        <Row k="Cel. do atleta" v={athlete.athlete_phone ?? "—"} />
        <Row k="Instagram" v={athlete.instagram ?? "—"} />
        <Row k="Categoria" v={athlete.category ?? "—"} />
        <Row k="Posição" v={athlete.position ?? "—"} />
        <Row k="Time" v={athlete.team ?? "—"} />
        <Row k="Altura" v={athlete.height_cm ? `${athlete.height_cm}cm` : "—"} />
        <Row k="Peso" v={athlete.weight_kg ? `${athlete.weight_kg}kg` : "—"} />
        <Row k="IMC" v={athlete.bmi ? String(athlete.bmi) : "—"} />
        <Row k="Na plataforma desde" v={athlete.joined_at ?? "—"} />
      </Card>

      <Card>
        <h3 className="mt-0 mb-3">Saúde & condição física</h3>
        <div
          className={`flex gap-2 items-start rounded-md px-3.5 py-3 text-[12.5px] mb-3.5 ${
            hasPain
              ? "bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000]"
              : "bg-chalk border border-line text-ink-soft"
          }`}
        >
          <span>{hasPain ? "⚠️" : "💪"}</span>
          <span>
            {hasPain
              ? `Relato ativo: ${athlete.current_pain}`
              : "Nenhuma dor relatada nos últimos check-ins."}
          </span>
        </div>
        <BarRow label="Adesão a treinos" pct={trainingPct} />
        <BarRow label="Adesão à dieta" pct={dietPct} />
      </Card>
    </div>
  );
}
