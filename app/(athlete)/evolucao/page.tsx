import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type TimelineEntry =
  | { type: "tactical"; date: string; title: string; strengths: string | null; improve: string | null }
  | { type: "mental"; date: string; title: string; body: string; score: number | null; video: string | null }
  | { type: "media"; date: string; items: { label: string; media_type: string; url: string | null }[] };

export default async function AthleteEvolucaoPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
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

  const [{ data: gameReports }, { data: mentalNotes }, { data: media }] = await Promise.all([
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
  ]);

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

  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <h2 className="text-[28px] mb-6">Minha evolução</h2>

      {entries.length === 0 ? (
        <Card>
          <EmptyState icon="📭" message="Nenhum registro na sua linha do tempo ainda." />
        </Card>
      ) : (
        <div className="relative pl-6.5">
          <div className="absolute left-2 top-1.5 bottom-1.5 w-0.5 bg-line" />
          {entries.map((e, i) => (
            <div key={i} className="relative pb-5.5">
              <div
                className="absolute -left-6.5 top-0 w-[18px] h-[18px] rounded-full border-[3px] border-chalk"
                style={{
                  background:
                    e.type === "mental" ? "#C0392B" : e.type === "media" ? "#FFD600" : "#111",
                }}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
