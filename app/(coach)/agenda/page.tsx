import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewMeetingModal } from "@/components/agenda/NewMeetingModal";
import { ManageMeetingModal } from "@/components/agenda/ManageMeetingModal";

export default async function CoachAgendaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, { data: meetings }] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("meetings")
      .select("id, title, scheduled_date, scheduled_time, meeting_type, notes, status, athletes(full_name)")
      .eq("club_id", profile!.clubId)
      .neq("status", "Cancelado")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-[28px] m-0">Encontros agendados</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Presenciais ou por videochamada, individuais por atleta
          </div>
        </div>
        {athletes && athletes.length > 0 && <NewMeetingModal athletes={athletes} />}
      </div>

      <Card>
        {!meetings || meetings.length === 0 ? (
          <EmptyState icon="🗓️" message="Nenhum encontro agendado." />
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
              />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
