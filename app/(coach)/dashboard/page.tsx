import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { initials } from "@/lib/utils/initials";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNowISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const clubId = profile!.clubId;
  const today = todayISO();
  const weekAhead = daysFromNowISO(7);

  const [
    { count: athletesCount },
    { data: checkinsToday },
    { count: meetingsThisWeekCount },
    { count: healthAlertsCount },
    { data: athletes },
    { data: upcomingMeetings },
  ] = await Promise.all([
    supabase
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId),
    supabase
      .from("checkins")
      .select("athlete_id")
      .eq("club_id", clubId)
      .eq("checkin_date", today),
    supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .neq("status", "Cancelado")
      .gte("scheduled_date", today)
      .lte("scheduled_date", weekAhead),
    supabase
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .not("current_pain", "is", null)
      .neq("current_pain", "Nenhuma"),
    supabase
      .from("athletes")
      .select("id, full_name, team, category, position, jersey_num, current_pain, photo_url, photo_color")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("meetings")
      .select("id, title, scheduled_date, scheduled_time, meeting_type, athletes(full_name)")
      .eq("club_id", clubId)
      .neq("status", "Cancelado")
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(6),
  ]);

  const total = athletesCount ?? 0;
  const checkinPct =
    total > 0
      ? Math.round(
          (new Set((checkinsToday ?? []).map((c) => c.athlete_id)).size / total) * 100,
        )
      : 0;

  const athletesWithPhotos = await Promise.all(
    (athletes ?? []).map(async (a) => ({
      ...a,
      signedPhotoUrl: await resolveSignedUrl("athlete-photos", a.photo_url),
    })),
  );

  return (
    <div>
      <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">
        Painel do treinador
      </div>
      <h1 className="text-[28px] mb-6">Olá, {profile!.fullName.split(" ")[0]} 👋</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Atletas ativos</span>
          <b className="block font-display text-[34px] leading-none mt-1">{total}</b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Check-ins hoje</span>
          <b className="block font-display text-[34px] leading-none mt-1">{checkinPct}%</b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Encontros esta semana</span>
          <b className="block font-display text-[34px] leading-none mt-1">
            {meetingsThisWeekCount ?? 0}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Alertas de saúde</span>
          <b className="block font-display text-[34px] leading-none mt-1">
            {healthAlertsCount ?? 0}
          </b>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <Card shadow>
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-[22px] m-0">Meus atletas</h2>
              <div className="text-xs text-ink-faint mt-0.5">
                Toque para abrir o perfil completo
              </div>
            </div>
            <Link href="/athletes" className="text-xs font-semibold text-pitch-dark hover:underline">
              Ver todos
            </Link>
          </div>
          {athletesWithPhotos.length === 0 ? (
            <EmptyState icon="👥" message="Nenhum atleta cadastrado ainda." />
          ) : (
            athletesWithPhotos.map((a) => (
              <Link
                key={a.id}
                href={`/athletes/${a.id}/dados`}
                className="flex items-center gap-3 px-2.5 py-3 rounded-md hover:bg-white hover:border hover:border-line hover:shadow-card border border-transparent"
              >
                {a.signedPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedPhotoUrl}
                    alt={a.full_name}
                    className="w-[38px] h-[38px] rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-[38px] h-[38px] rounded-lg flex items-center justify-center font-display text-base shrink-0"
                    style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                  >
                    {initials(a.full_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <b className="block text-sm truncate">{a.full_name}</b>
                  <span className="text-xs text-ink-faint truncate block">
                    {a.team ?? "—"} · {a.category} · {a.position?.join(", ")}
                  </span>
                </div>
                <Badge tone={!a.current_pain || a.current_pain === "Nenhuma" ? "green" : "clay"}>
                  {!a.current_pain || a.current_pain === "Nenhuma" ? "Apto" : "Atenção"}
                </Badge>
              </Link>
            ))
          )}
        </Card>

        <Card shadow>
          <div className="mb-3.5">
            <h2 className="text-[22px] m-0">Próximos encontros</h2>
            <div className="text-xs text-ink-faint mt-0.5">Agenda semanal</div>
          </div>
          {!upcomingMeetings || upcomingMeetings.length === 0 ? (
            <EmptyState icon="🗓️" message="Nenhum encontro agendado." />
          ) : (
            upcomingMeetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3.5 py-3 border-b border-line last:border-b-0">
                <div className="w-[34px] h-[34px] rounded-lg bg-amber text-pitch-dark flex items-center justify-center font-display text-[13px] shrink-0">
                  {m.scheduled_time?.slice(0, 5)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold m-0 truncate">{m.title}</h4>
                  <p className="text-xs text-ink-faint m-0">
                    {(m.athletes as unknown as { full_name: string } | null)?.full_name} ·{" "}
                    {m.scheduled_date}
                  </p>
                </div>
                <Badge tone={m.meeting_type === "Videochamada" ? "sky" : "green"}>
                  {m.meeting_type === "Videochamada" ? "🎥 Vídeo" : "📍 Presencial"}
                </Badge>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="flex gap-2 items-start bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px] mt-4.5">
        <span>🛡️</span>
        <span>
          Este painel exibe dados de saúde e de menores de idade. Acesso restrito a
          treinadores autorizados do clube.
        </span>
      </div>
    </div>
  );
}
