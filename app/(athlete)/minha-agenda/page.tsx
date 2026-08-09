import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmMeetingButton } from "@/components/agenda/ConfirmMeetingButton";

export default async function AthleteAgendaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: meetings } = profile?.athleteId
    ? await supabase
        .from("meetings")
        .select(
          "id, title, scheduled_date, scheduled_time, meeting_type, notes, status, athlete_confirmed, material_video_url, purpose, plays(name)",
        )
        .eq("athlete_id", profile.athleteId)
        .neq("status", "Cancelado")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
    : { data: null };

  return (
    <div>
      <h2 className="text-[28px] mb-6">Minha agenda</h2>
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
                  {m.scheduled_date}
                  {m.notes ? ` · ${m.notes}` : ""}
                </p>
                {(m.plays || m.material_video_url) && (
                  <p className="text-xs mt-1 flex gap-2 flex-wrap">
                    {m.plays && (
                      <a href="/mesa-tatica" className="font-semibold text-pitch-dark hover:underline">
                        🎯 {(m.plays as unknown as { name: string }).name}
                      </a>
                    )}
                    {m.material_video_url && (
                      <a
                        href={m.material_video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-pitch-dark hover:underline"
                      >
                        ▶ Vídeo de preparo
                      </a>
                    )}
                  </p>
                )}
              </div>
              <Badge tone={m.purpose === "Treino" ? "sky" : "amber"}>
                {m.purpose === "Treino" ? "🏋️ Treino" : "🎯 Específico"}
              </Badge>
              <Badge tone={m.meeting_type === "Videochamada" ? "sky" : "green"}>
                {m.meeting_type === "Videochamada" ? "🎥 Vídeo" : "📍 Presencial"}
              </Badge>
              {m.athlete_confirmed ? (
                <Badge tone="green">✅ Confirmado</Badge>
              ) : (
                <ConfirmMeetingButton meetingId={m.id} />
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
