import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PlayerScoreCard } from "@/components/athletes/PlayerScoreCard";
import { RequestCancellationButton } from "@/components/athletes/RequestCancellationButton";
import { ScoreChangeAlert } from "@/components/athletes/ScoreChangeAlert";
import { computePlayerScore } from "@/lib/scoring";
import { getScoreChange } from "@/lib/scoreHistory";
import { getAthleteChallengePoints } from "@/lib/challengePoints";
import { initials } from "@/lib/utils/initials";
import { INJURY_SEVERITY_META } from "@/lib/data/injuries";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-line text-[13.5px] last:border-b-0">
      <span className="text-ink-faint">{k}</span>
      <b>{v}</b>
    </div>
  );
}

export default async function AthletePerfilPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile?.athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta. Fale com seu treinador.
        </p>
      </Card>
    );
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("id", profile.athleteId)
    .single();

  if (!athlete) return null;

  const [signedPhotoUrl, score, { data: lineupRows }, { data: pendingCancellation }, { data: activeInjuries }] =
    await Promise.all([
      resolveSignedUrl("athlete-photos", athlete.photo_url),
      computePlayerScore(supabase, athlete.id),
      supabase
        .from("game_lineups")
        .select(
          "status, notes, games(id, opponent, scheduled_date, scheduled_time, lineup_video_url, plays(name))",
        )
        .eq("athlete_id", athlete.id),
      supabase
        .from("athlete_cancellation_requests")
        .select("reason_category, requested_at")
        .eq("athlete_id", athlete.id)
        .eq("status", "Pendente")
        .maybeSingle(),
      supabase
        .from("athlete_injuries")
        .select("id, body_region, injury_type, severity, status, expected_return_date, treatment_notes")
        .eq("athlete_id", athlete.id)
        .neq("status", "Recuperado")
        .order("occurred_at", { ascending: false }),
    ]);
  const scoreChange = await getScoreChange(supabase, profile.clubId, athlete.id, score);
  const challengePoints = await getAthleteChallengePoints(supabase, athlete.id);
  const hasPain = athlete.current_pain && athlete.current_pain !== "Nenhuma";
  const today = new Date().toISOString().slice(0, 10);
  const upcomingConvocations = (lineupRows ?? [])
    .map((l) => ({
      status: l.status,
      notes: l.notes,
      game: l.games as unknown as {
        id: string;
        opponent: string;
        scheduled_date: string;
        scheduled_time: string | null;
        lineup_video_url: string | null;
        plays: { name: string } | null;
      } | null,
    }))
    .filter((l) => l.game && l.game.scheduled_date >= today)
    .sort((a, b) => a.game!.scheduled_date.localeCompare(b.game!.scheduled_date));

  return (
    <div>
      <Card shadow className="flex gap-4.5 items-center mb-4.5 flex-wrap">
        {signedPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedPhotoUrl}
            alt={athlete.full_name}
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center font-display text-[26px] shrink-0"
            style={{ background: athlete.photo_color ?? "#111", color: "#FFD600" }}
          >
            {initials(athlete.full_name)}
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <h2 className="m-0 mb-1 font-sans text-xl font-extrabold">{athlete.full_name}</h2>
          <div className="flex gap-1.5 flex-wrap">
            {athlete.category && <Badge tone="green">{athlete.category}</Badge>}
            {athlete.position?.map((p) => (
              <Badge key={p} tone="amber">
                {p}
              </Badge>
            ))}
            {athlete.team && <Badge tone="sky">{athlete.team}</Badge>}
          </div>
        </div>
        <div className="flex gap-6.5 text-center">
          <div>
            <b className="font-mono text-lg block">
              {athlete.height_cm ? `${athlete.height_cm}cm` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Altura</span>
          </div>
          <div>
            <b className="font-mono text-lg block">
              {athlete.weight_kg ? `${athlete.weight_kg}kg` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Peso</span>
          </div>
          <div>
            <b className="font-mono text-lg block">{athlete.bmi ?? "—"}</b>
            <span className="text-[11px] text-ink-faint">IMC</span>
          </div>
        </div>
      </Card>

      {upcomingConvocations.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-4">
          {upcomingConvocations.map((l) => (
            <Card key={l.game!.id} className="border-l-4 border-l-pitch-dark">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                <b className="text-sm">📣 Convocado — vs. {l.game!.opponent}</b>
                <Badge tone={l.status === "Titular" ? "green" : l.status === "Reserva" ? "sky" : "amber"}>
                  {l.status}
                </Badge>
              </div>
              <p className="text-xs text-ink-faint m-0 mb-1.5">
                {l.game!.scheduled_date}
                {l.game!.scheduled_time ? ` às ${l.game!.scheduled_time.slice(0, 5)}` : ""}
              </p>
              {l.notes && (
                <p className="text-[12.5px] bg-chalk border border-line rounded-sm px-2.5 py-2 m-0 mb-1.5">
                  {l.notes}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                {l.game!.plays?.name && (
                  <Link
                    href="/mesa-tatica"
                    className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                  >
                    🎯 Jogada: {l.game!.plays.name}
                  </Link>
                )}
                {l.game!.lineup_video_url && (
                  <a
                    href={l.game!.lineup_video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                  >
                    ▶ Ver vídeo
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ScoreChangeAlert result={scoreChange} warnings={score.warnings} />

      <div className="mb-4">
        <PlayerScoreCard
          score={score}
          photoUrl={signedPhotoUrl}
          photoColor={athlete.photo_color}
          initials={initials(athlete.full_name)}
          fullName={athlete.full_name}
          position={athlete.position?.join(", ") || null}
          challengePoints={challengePoints}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 mb-3">Meus dados</h3>
          <Row k="Nascimento" v={athlete.birth_date ?? "—"} />
          <Row k="Responsável" v={athlete.guardian_name ?? "—"} />
          <Row k="Categoria" v={athlete.category ?? "—"} />
          <Row k="Posição" v={athlete.position?.join(", ") || "—"} />
          <Row k="Time" v={athlete.team ?? "—"} />
          <Row k="Na plataforma desde" v={athlete.joined_at ?? "—"} />
        </Card>
        <Card>
          <h3 className="mt-0 mb-3">Contrato</h3>
          <RequestCancellationButton
            pendingRequest={
              pendingCancellation
                ? { reasonCategory: pendingCancellation.reason_category, requestedAt: pendingCancellation.requested_at }
                : null
            }
          />
        </Card>
        <Card>
          <h3 className="mt-0 mb-3">Saúde & condição física</h3>
          <div
            className={`flex gap-2 items-start rounded-md px-3.5 py-3 text-[12.5px] ${
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
          {activeInjuries && activeInjuries.length > 0 && (
            <div className="mt-3.5 pt-3.5 border-t border-line flex flex-col gap-2">
              {activeInjuries.map((inj) => (
                <div key={inj.id} className="text-[12.5px]">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <Badge tone={INJURY_SEVERITY_META[inj.severity].tone}>{inj.body_region}</Badge>
                    <span className="text-ink-faint">{inj.injury_type} · {inj.status}</span>
                  </div>
                  {inj.expected_return_date && (
                    <span className="text-ink-faint">Previsão de retorno: {inj.expected_return_date}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
