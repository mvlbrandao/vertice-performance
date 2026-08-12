import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AthleteHeroCard } from "@/components/athletes/AthleteHeroCard";
import { ScoreChangeAlert } from "@/components/athletes/ScoreChangeAlert";
import { computePlayerScore } from "@/lib/scoring";
import { getScoreChange } from "@/lib/scoreHistory";
import { getAthleteChallengePoints } from "@/lib/challengePoints";
import { initials } from "@/lib/utils/initials";
import { INJURY_SEVERITY_META } from "@/lib/data/injuries";
import { AthleteComparisonCard } from "@/components/scouting/AthleteComparisonCard";
import { getClubPeerCloud, getSystemPercentile } from "@/lib/scouting/peerScoring";

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

  const today = new Date().toISOString().slice(0, 10);
  const [signedPhotoUrl, score, { data: lineupRows }, { data: activeInjuries }, { data: upcomingMeetings }] =
    await Promise.all([
      resolveSignedUrl("athlete-photos", athlete.photo_url),
      computePlayerScore(supabase, athlete.id),
      supabase
        .from("game_lineups")
        .select(
          "status, notes, games(id, opponent, scheduled_date, scheduled_time, location, lineup_video_url, plays(name))",
        )
        .eq("athlete_id", athlete.id),
      supabase
        .from("athlete_injuries")
        .select("id, body_region, injury_type, severity, status, expected_return_date, treatment_notes")
        .eq("athlete_id", athlete.id)
        .neq("status", "Recuperado")
        .order("occurred_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("id, title, meeting_type, scheduled_date, scheduled_time, athlete_confirmed")
        .eq("athlete_id", athlete.id)
        .eq("status", "Agendado")
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true })
        .limit(5),
    ]);
  const scoreChange = await getScoreChange(supabase, profile.clubId, athlete.id, score);
  const challengePoints = await getAthleteChallengePoints(supabase, athlete.id);
  const [categoryCloud, clubCloud, systemPercentile] = await Promise.all([
    getClubPeerCloud(profile.clubId, athlete.id, athlete.category),
    getClubPeerCloud(profile.clubId, athlete.id),
    getSystemPercentile(athlete.id, athlete.category),
  ]);
  const hasPain = athlete.current_pain && athlete.current_pain !== "Nenhuma";
  const upcomingConvocations = (lineupRows ?? [])
    .map((l) => ({
      status: l.status,
      notes: l.notes,
      game: l.games as unknown as {
        id: string;
        opponent: string;
        scheduled_date: string;
        scheduled_time: string | null;
        location: string | null;
        lineup_video_url: string | null;
        plays: { name: string } | null;
      } | null,
    }))
    .filter((l) => l.game && l.game.scheduled_date >= today)
    .sort((a, b) => a.game!.scheduled_date.localeCompare(b.game!.scheduled_date));

  return (
    <div>
      <AthleteHeroCard
        score={score}
        photoUrl={signedPhotoUrl}
        photoColor={athlete.photo_color}
        initials={initials(athlete.full_name)}
        fullName={athlete.full_name}
        category={athlete.category}
        positions={athlete.position}
        team={athlete.team}
        heightCm={athlete.height_cm}
        weightKg={athlete.weight_kg}
        bmi={athlete.bmi}
        challengePoints={challengePoints}
      />

      <ScoreChangeAlert result={scoreChange} warnings={score.warnings} />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <h3 className="mt-0 mb-3">🏆 Próximos jogos</h3>
          {upcomingConvocations.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint m-0">Nenhuma convocação por enquanto.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {upcomingConvocations.map((l) => (
                <div key={l.game!.id} className="border-l-[3px] border-l-pitch-dark pl-3 py-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <b className="text-[13.5px]">vs. {l.game!.opponent}</b>
                    <Badge
                      tone={l.status === "Titular" ? "green" : l.status === "Reserva" ? "sky" : "amber"}
                    >
                      {l.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-ink-faint block">
                    {l.game!.scheduled_date}
                    {l.game!.scheduled_time ? ` às ${l.game!.scheduled_time.slice(0, 5)}` : ""}
                    {l.game!.location ? ` · ${l.game!.location}` : ""}
                  </span>
                  {l.notes && (
                    <p className="text-[12px] bg-chalk border border-line rounded-sm px-2 py-1.5 mt-1.5 mb-0">
                      {l.notes}
                    </p>
                  )}
                  {(l.game!.plays?.name || l.game!.lineup_video_url) && (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {l.game!.plays?.name && (
                        <Link
                          href="/mesa-tatica"
                          className="text-[11px] font-semibold border border-line rounded-sm px-2 py-1 hover:border-pitch-dark"
                        >
                          🎯 {l.game!.plays.name}
                        </Link>
                      )}
                      {l.game!.lineup_video_url && (
                        <a
                          href={l.game!.lineup_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold border border-line rounded-sm px-2 py-1 hover:border-pitch-dark"
                        >
                          ▶ Vídeo
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mt-0 mb-3">🗓️ Próximos encontros</h3>
          {!upcomingMeetings || upcomingMeetings.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint m-0">Nenhum encontro agendado.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="border-l-[3px] border-l-amber pl-3 py-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <b className="text-[13.5px]">{m.title}</b>
                    {m.athlete_confirmed && <Badge tone="green">Confirmado</Badge>}
                  </div>
                  <span className="text-xs text-ink-faint block">
                    {m.scheduled_date}
                    {m.scheduled_time ? ` às ${m.scheduled_time.slice(0, 5)}` : ""} · {m.meeting_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>


      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 mb-3">Meus dados</h3>
          <Row k="Nascimento" v={athlete.birth_date ?? "—"} />
          <Row k="Responsável" v={athlete.guardian_name ?? "—"} />
          <Row k="Na plataforma desde" v={athlete.joined_at ?? "—"} />
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

      <Card className="mt-4">
        <h3 className="mt-0 mb-3">Onde eu estou — Ofensivo × Defensivo</h3>
        <AthleteComparisonCard
          own={{ attack: score.attack, defense: score.defense }}
          categoryCloud={categoryCloud}
          clubCloud={clubCloud}
          systemPercentile={systemPercentile}
          category={athlete.category}
        />
      </Card>
    </div>
  );
}
