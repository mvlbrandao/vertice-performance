import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewMentalNoteModal } from "@/components/timeline/NewMentalNoteModal";
import { NewMediaModal } from "@/components/timeline/NewMediaModal";
import { NewGameReportModal } from "@/components/timeline/NewGameReportModal";

type TimelineEntry =
  | { type: "tactical"; date: string; title: string; strengths: string | null; improve: string | null }
  | { type: "mental"; date: string; title: string; body: string; score: number | null; video: string | null }
  | { type: "media"; date: string; items: { label: string; media_type: string; url: string | null }[] }
  | {
      type: "meeting";
      date: string;
      title: string;
      time: string;
      meetingType: string;
      status: string;
      confirmed: boolean;
      hasCheckin: boolean;
    }
  | {
      type: "exercise";
      date: string;
      name: string;
      description: string | null;
      focus: string | null;
      done: boolean;
      videoUrl: string | null;
      hasCheckin: boolean;
    }
  | {
      type: "game";
      date: string;
      opponent: string;
      competitionName: string;
      time: string | null;
      location: string | null;
      ourScore: number | null;
      opponentScore: number | null;
      events: { eventType: string; goalType: string | null; minute: number | null }[];
    }
  | {
      type: "transfer";
      date: string;
      fromClub: string | null;
      toClub: string;
      fromCategory: string | null;
      toCategory: string | null;
    };

const EVENT_ICON: Record<string, string> = {
  Gol: "⚽",
  Assistência: "🅰️",
  Falta: "⚠️",
  "Cartão amarelo": "🟨",
  "Cartão vermelho": "🟥",
  Lesão: "🤕",
  "Pênalti sofrido": "🎯",
  "Pênalti perdido": "❌",
  "Pênalti defendido": "🧤",
  Escanteio: "🚩",
  Lateral: "↩️",
  Desarme: "🛡️",
  Interceptação: "✋",
  Cruzamento: "🎯",
  "Finalização certa": "🎯",
  "Finalização errada": "💨",
  Impedimento: "🚫",
  Defesa: "🧤",
  "Passe certo": "✅",
  "Passe errado": "↪️",
};

const DOT_COLOR: Record<TimelineEntry["type"], string> = {
  tactical: "#111111",
  mental: "#C0392B",
  media: "#FFD600",
  meeting: "#3D7EA6",
  exercise: "#1A6B3C",
  game: "#6B21A8",
  transfer: "#555555",
};

export default async function AthleteEvolucaoPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("athletes")
    .select("team, category")
    .eq("id", athleteId)
    .single();

  const [
    { data: gameReports },
    { data: mentalNotes },
    { data: media },
    { data: meetings },
    { data: exercises },
    { data: checkins },
    { data: games },
    { data: transfers },
    { data: partnerClubs },
    { data: gameEvents },
  ] = await Promise.all([
    supabase
      .from("game_reports")
      .select("entry_date, opponent, strengths, improve")
      .eq("athlete_id", athleteId),
    supabase
      .from("mental_notes")
      .select("entry_date, title, body, confidence_score, video_url")
      .eq("athlete_id", athleteId),
    supabase
      .from("media_items")
      .select("entry_date, label, media_type, storage_path")
      .eq("athlete_id", athleteId),
    supabase
      .from("meetings")
      .select("scheduled_date, scheduled_time, title, meeting_type, status, athlete_confirmed")
      .eq("athlete_id", athleteId)
      .neq("status", "Cancelado"),
    supabase
      .from("exercises")
      .select("scheduled_date, name, description, focus, done, video_url")
      .eq("athlete_id", athleteId),
    supabase.from("checkins").select("checkin_date").eq("athlete_id", athleteId),
    supabase
      .from("games")
      .select(
        "id, scheduled_date, scheduled_time, location, opponent, our_score, opponent_score, competitions(name)",
      )
      .eq("club_id", profile!.clubId)
      .or(
        `target_athlete_id.eq.${athleteId}${
          athlete?.team && athlete?.category
            ? `,and(target_team.eq.${athlete.team},target_category.eq.${athlete.category})`
            : ""
        }`,
      ),
    supabase
      .from("athlete_club_transfers")
      .select("transferred_at, from_partner_club_id, from_category, to_partner_club_id, to_category")
      .eq("athlete_id", athleteId),
    supabase.from("partner_clubs").select("id, name").eq("club_id", profile!.clubId),
    supabase
      .from("game_events")
      .select("game_id, event_type, goal_type, minute")
      .eq("athlete_id", athleteId),
  ]);

  const clubNameById = new Map((partnerClubs ?? []).map((c) => [c.id, c.name]));
  const checkinDates = new Set((checkins ?? []).map((c) => c.checkin_date));
  const eventsByGame = new Map<string, { eventType: string; goalType: string | null; minute: number | null }[]>();
  for (const e of gameEvents ?? []) {
    const list = eventsByGame.get(e.game_id) ?? [];
    list.push({ eventType: e.event_type, goalType: e.goal_type, minute: e.minute });
    eventsByGame.set(e.game_id, list);
  }

  const entries: TimelineEntry[] = [];
  (gameReports ?? []).forEach((g) =>
    entries.push({
      type: "tactical",
      date: g.entry_date,
      title: `Relatório de jogo — ${g.opponent}`,
      strengths: g.strengths,
      improve: g.improve,
    }),
  );
  (mentalNotes ?? []).forEach((m) =>
    entries.push({
      type: "mental",
      date: m.entry_date,
      title: m.title,
      body: m.body,
      score: m.confidence_score,
      video: m.video_url,
    }),
  );
  const mediaByDate = new Map<string, { label: string; media_type: string; url: string | null }[]>();
  for (const m of media ?? []) {
    const url = await resolveSignedUrl("athlete-media", m.storage_path);
    const list = mediaByDate.get(m.entry_date) ?? [];
    list.push({ label: m.label, media_type: m.media_type, url });
    mediaByDate.set(m.entry_date, list);
  }
  mediaByDate.forEach((items, date) => entries.push({ type: "media", date, items }));
  (meetings ?? []).forEach((m) =>
    entries.push({
      type: "meeting",
      date: m.scheduled_date,
      title: m.title,
      time: m.scheduled_time,
      meetingType: m.meeting_type,
      status: m.status,
      confirmed: m.athlete_confirmed,
      hasCheckin: checkinDates.has(m.scheduled_date),
    }),
  );
  (exercises ?? []).forEach((e) =>
    entries.push({
      type: "exercise",
      date: e.scheduled_date,
      name: e.name,
      description: e.description,
      focus: e.focus,
      done: e.done,
      videoUrl: e.video_url,
      hasCheckin: checkinDates.has(e.scheduled_date),
    }),
  );
  (games ?? []).forEach((g) =>
    entries.push({
      type: "game",
      date: g.scheduled_date,
      opponent: g.opponent,
      competitionName: (g.competitions as unknown as { name: string } | null)?.name ?? "—",
      time: g.scheduled_time,
      location: g.location,
      ourScore: g.our_score,
      opponentScore: g.opponent_score,
      events: eventsByGame.get(g.id) ?? [],
    }),
  );
  (transfers ?? []).forEach((t) =>
    entries.push({
      type: "transfer",
      date: t.transferred_at,
      fromClub: t.from_partner_club_id ? clubNameById.get(t.from_partner_club_id) ?? null : null,
      toClub: clubNameById.get(t.to_partner_club_id) ?? "—",
      fromCategory: t.from_category,
      toCategory: t.to_category,
    }),
  );

  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div>
          <h2 className="text-[19px] m-0">Linha do tempo de evolução</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Cruzamento de análises táticas, mentais, mídia, agenda e treinos
          </div>
        </div>
        <div className="flex gap-2">
          <NewMediaModal clubId={profile!.clubId} athleteId={athleteId} />
          <NewMentalNoteModal athleteId={athleteId} />
          <NewGameReportModal athleteId={athleteId} />
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <EmptyState icon="📭" message="Nenhum registro na linha do tempo ainda." />
        </Card>
      ) : (
        <div className="relative pl-6.5">
          <div className="absolute left-2 top-1.5 bottom-1.5 w-0.5 bg-line" />
          {entries.map((e, i) => (
            <div key={i} className="relative pb-5.5">
              <div
                className="absolute -left-6.5 top-0 w-[18px] h-[18px] rounded-full border-[3px] border-chalk"
                style={{ background: DOT_COLOR[e.type] }}
              />
              <div className="bg-white border border-line rounded-md px-4 py-3.5">
                {e.type === "tactical" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px]">
                      <Badge tone="green">Tático</Badge>
                      <span className="font-mono text-ink-faint">{e.date}</span>
                    </div>
                    <h4 className="m-0 mb-1.5 text-[15px] font-bold">{e.title}</h4>
                    <p className="m-0 text-[13.5px] text-ink-soft leading-relaxed">
                      <b>Pontos fortes:</b> {e.strengths || "—"}
                    </p>
                    <p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
                      <b>A melhorar:</b> {e.improve || "—"}
                    </p>
                  </>
                )}
                {e.type === "mental" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px] flex-wrap">
                      <Badge tone="sky">Mental</Badge>
                      <span className="font-mono text-ink-faint">{e.date}</span>
                      {e.score != null && <Badge tone="amber">Confiança {e.score}/10</Badge>}
                    </div>
                    <h4 className="m-0 mb-1.5 text-[15px] font-bold">{e.title}</h4>
                    <p className="m-0 text-[13.5px] text-ink-soft leading-relaxed">{e.body}</p>
                    {e.video && (
                      <a
                        href={e.video}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex mt-2.5 text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                      >
                        ▶ Ver vídeo de apoio
                      </a>
                    )}
                  </>
                )}
                {e.type === "media" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px]">
                      <Badge tone="amber">Mídia</Badge>
                      <span className="font-mono text-ink-faint">{e.date}</span>
                    </div>
                    <h4 className="m-0 mb-1.5 text-[15px] font-bold">Artefatos de mídia anexados</h4>
                    <div className="flex gap-2 flex-wrap mt-2.5">
                      {e.items.map((m, mi) =>
                        m.url ? (
                          <a
                            key={mi}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={m.label}
                            className="w-[74px] h-[52px] rounded-md flex items-center justify-center text-white text-[11px] font-bold"
                            style={{ background: m.media_type === "video" ? "#C1432B" : "#3D7EA6" }}
                          >
                            {m.media_type === "video" ? "▶ VÍDEO" : "🖼 FOTO"}
                          </a>
                        ) : (
                          <div
                            key={mi}
                            title={m.label}
                            className="w-[74px] h-[52px] rounded-md flex items-center justify-center text-white text-[11px] font-bold"
                            style={{ background: m.media_type === "video" ? "#C1432B" : "#3D7EA6" }}
                          >
                            {m.media_type === "video" ? "▶ VÍDEO" : "🖼 FOTO"}
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
                {e.type === "meeting" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px] flex-wrap">
                      <Badge tone="sky">
                        {e.meetingType === "Videochamada" ? "🎥 Encontro" : "📍 Encontro"}
                      </Badge>
                      <span className="font-mono text-ink-faint">
                        {e.date} às {e.time?.slice(0, 5)}
                      </span>
                      <Badge tone={e.confirmed ? "green" : "amber"}>
                        {e.confirmed ? "✅ Confirmado" : "⏳ Aguardando confirmação"}
                      </Badge>
                      {e.status !== "Agendado" && <Badge tone="dark">{e.status}</Badge>}
                      {e.hasCheckin && <Badge tone="green">☑️ Check-in do dia</Badge>}
                    </div>
                    <h4 className="m-0 text-[15px] font-bold">{e.title}</h4>
                  </>
                )}
                {e.type === "exercise" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px] flex-wrap">
                      <Badge tone="green">🏋️ Treino prescrito</Badge>
                      <span className="font-mono text-ink-faint">{e.date}</span>
                      <Badge tone={e.done ? "green" : "amber"}>
                        {e.done ? "✅ Concluído" : "⏳ Pendente"}
                      </Badge>
                      {e.hasCheckin && <Badge tone="green">☑️ Check-in do dia</Badge>}
                    </div>
                    <h4 className="m-0 mb-1.5 text-[15px] font-bold">{e.name}</h4>
                    {e.focus && (
                      <p className="m-0 text-[13.5px] text-ink-soft leading-relaxed">
                        <b>Foco:</b> {e.focus}
                      </p>
                    )}
                    {e.description && (
                      <p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
                        {e.description}
                      </p>
                    )}
                    {e.videoUrl && (
                      <a
                        href={e.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex mt-2.5 text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                      >
                        ▶ Ver vídeo do treino
                      </a>
                    )}
                  </>
                )}
                {e.type === "game" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px] flex-wrap">
                      <Badge tone="dark">🏆 Jogo — {e.competitionName}</Badge>
                      <span className="font-mono text-ink-faint">
                        {e.date}
                        {e.time ? ` às ${e.time.slice(0, 5)}` : ""}
                      </span>
                      {e.ourScore != null && e.opponentScore != null && (
                        <Badge tone="green">
                          {e.ourScore} × {e.opponentScore}
                        </Badge>
                      )}
                    </div>
                    <h4 className="m-0 text-[15px] font-bold">vs. {e.opponent}</h4>
                    {e.location && (
                      <p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
                        📍 {e.location}
                      </p>
                    )}
                    {e.events.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {e.events.map((ev, i) => (
                          <Badge key={i} tone="amber">
                            {EVENT_ICON[ev.eventType] ?? "•"} {ev.eventType}
                            {ev.goalType && ev.goalType !== "Normal" ? ` (${ev.goalType})` : ""}
                            {ev.minute != null ? ` ${ev.minute}'` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {e.type === "transfer" && (
                  <>
                    <div className="flex gap-2 items-center mb-1.5 text-[11px]">
                      <Badge tone="dark">🔁 Transferência</Badge>
                      <span className="font-mono text-ink-faint">{e.date}</span>
                    </div>
                    <h4 className="m-0 text-[15px] font-bold">
                      {e.fromClub ?? "—"} → {e.toClub}
                    </h4>
                    {(e.fromCategory || e.toCategory) && (
                      <p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
                        {e.fromCategory ?? "—"} → {e.toCategory ?? "—"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
