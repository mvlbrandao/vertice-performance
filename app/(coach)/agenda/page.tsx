import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewMeetingModal } from "@/components/agenda/NewMeetingModal";
import { ManageMeetingModal } from "@/components/agenda/ManageMeetingModal";
import { cn } from "@/lib/utils/cn";
import { getPartnerClubOptions } from "@/lib/data/partnerClubs";
import type { MeetingStatus } from "@/lib/types/database";

const STATUS_FILTERS: { value: string; label: string; status: MeetingStatus | null }[] = [
  { value: "agendados", label: "Agendados", status: "Agendado" },
  { value: "concluidos", label: "Concluídos", status: "Concluído" },
  { value: "cancelados", label: "Cancelados", status: "Cancelado" },
  { value: "todos", label: "Todos", status: null },
];

export default async function CoachAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeFilter =
    STATUS_FILTERS.find((f) => f.value === statusParam) ?? STATUS_FILTERS[0];

  const profile = await getSessionProfile();
  const supabase = await createClient();

  let meetingsQuery = supabase
    .from("meetings")
    .select(
      "id, title, scheduled_date, scheduled_time, meeting_type, notes, status, athlete_confirmed, play_id, material_video_url, purpose, athletes(full_name)",
    )
    .eq("club_id", profile!.clubId)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true });

  if (activeFilter.status) {
    meetingsQuery = meetingsQuery.eq("status", activeFilter.status);
  }

  const [{ data: athletes }, { data: meetings }, partnerClubs, { data: plays }, { data: openCycles }] =
    await Promise.all([
      supabase
        .from("athletes")
        .select("id, full_name, position")
        .eq("club_id", profile!.clubId)
        .order("full_name", { ascending: true }),
      meetingsQuery,
      getPartnerClubOptions(supabase, profile!.clubId),
      supabase
        .from("plays")
        .select("id, name")
        .or(`club_id.eq.${profile!.clubId},is_global.eq.true`)
        .order("name", { ascending: true }),
      supabase
        .from("athlete_swot_cycles")
        .select("id")
        .eq("club_id", profile!.clubId)
        .eq("status", "Aberto"),
    ]);

  const teams = partnerClubs.map((c) => c.name);

  const athletePositions: Record<string, string[]> = {};
  for (const a of athletes ?? []) {
    athletePositions[a.id] = a.position ?? [];
  }

  const openCycleIds = (openCycles ?? []).map((c) => c.id);
  const { data: openSwotItemRows } =
    openCycleIds.length > 0
      ? await supabase
          .from("athlete_swot_items")
          .select("id, athlete_id, category, description")
          .in("cycle_id", openCycleIds)
          .eq("status", "Aberto")
      : { data: [] };

  const openSwotItemsByAthlete: Record<
    string,
    { id: string; category: string; description: string }[]
  > = {};
  for (const it of openSwotItemRows ?? []) {
    const list = openSwotItemsByAthlete[it.athlete_id] ?? [];
    list.push({ id: it.id, category: it.category, description: it.description });
    openSwotItemsByAthlete[it.athlete_id] = list;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-[28px] m-0">Encontros agendados</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Presenciais ou por videochamada, individuais por atleta
          </div>
        </div>
        {athletes && athletes.length > 0 && (
          <NewMeetingModal
            athletes={athletes}
            teams={teams}
            plays={plays ?? []}
            openSwotItemsByAthlete={openSwotItemsByAthlete}
            athletePositions={athletePositions}
          />
        )}
      </div>

      <div className="flex gap-1.5 mb-4">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "agendados" ? "/agenda" : `/agenda?status=${f.value}`}
            className={cn(
              "px-3 py-1.5 rounded-sm text-[12.5px] font-semibold border",
              activeFilter.value === f.value
                ? "bg-pitch-dark text-chalk border-pitch-dark"
                : "border-line text-ink-soft hover:border-pitch-dark",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        {!meetings || meetings.length === 0 ? (
          <EmptyState icon="🗓️" message="Nenhum encontro nessa visão." />
        ) : (
          meetings.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3.5 py-3 border-b border-line last:border-b-0 flex-wrap"
            >
              <div
                className="w-11 h-11 rounded-lg text-white flex items-center justify-center text-[13px] shrink-0"
                style={{ background: m.meeting_type === "Videochamada" ? "#C0392B" : "#1A1A1A" }}
              >
                {m.scheduled_time?.slice(0, 5)}
              </div>
              <div className="flex-1 min-w-[160px]">
                <h4 className="text-sm font-semibold m-0">{m.title}</h4>
                <p className="text-xs text-ink-faint m-0">
                  {(m.athletes as unknown as { full_name: string } | null)?.full_name} ·{" "}
                  {m.scheduled_date}
                  {m.notes ? " · Notas registradas" : ""}
                </p>
              </div>
              <Badge tone={m.purpose === "Treino" ? "sky" : "amber"}>
                {m.purpose === "Treino" ? "🏋️ Treino" : "🎯 Específico"}
              </Badge>
              {(m.play_id || m.material_video_url) && <Badge tone="dark">📎 Material</Badge>}
              {m.status !== "Agendado" && (
                <Badge tone={m.status === "Concluído" ? "green" : "clay"}>{m.status}</Badge>
              )}
              <Badge tone={m.athlete_confirmed ? "green" : "amber"}>
                {m.athlete_confirmed ? "✅ Confirmado" : "⏳ Aguardando"}
              </Badge>
              <Badge tone={m.meeting_type === "Videochamada" ? "sky" : "green"}>
                {m.meeting_type === "Videochamada" ? "🎥 Vídeo" : "📍 Presencial"}
              </Badge>
              <ManageMeetingModal
                meetingId={m.id}
                title={m.title}
                athleteName={(m.athletes as unknown as { full_name: string } | null)?.full_name ?? "—"}
                date={m.scheduled_date}
                time={m.scheduled_time}
                type={m.meeting_type}
                initialNotes={m.notes ?? ""}
                athleteConfirmed={m.athlete_confirmed}
              />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
