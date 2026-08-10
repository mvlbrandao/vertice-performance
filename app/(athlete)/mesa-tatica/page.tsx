import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayViewer } from "@/components/plays/PlayViewer";
import type { PlayFrame, PlaySportType } from "@/lib/types/plays";

export default async function AthleteMesaTaticaPage() {
  const supabase = await createClient();

  const { data: plays } = await supabase
    .from("plays")
    .select("id, name, description, target_type, target_team, video_url, frames, sport_type, is_global")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-[19px] mb-3.5">Mesa Tática</h2>

      {!plays || plays.length === 0 ? (
        <Card>
          <EmptyState icon="🎯" message="Nenhuma jogada compartilhada com você ainda." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {plays.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <h4 className="m-0 text-[15px] font-bold">{p.name}</h4>
                <Badge tone={p.is_global ? "green" : p.target_type === "team" ? "sky" : "amber"}>
                  {p.is_global ? "⭐ Padrão" : p.target_type === "team" ? p.target_team : "Individual"}
                </Badge>
              </div>
              {p.description && (
                <p className="text-[13px] text-ink-soft mb-3">{p.description}</p>
              )}
              <PlayViewer
                frames={(p.frames as unknown as PlayFrame[]) ?? []}
                sportType={p.sport_type as PlaySportType}
              />
              {p.video_url && (
                <a
                  href={p.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex mt-3 text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                >
                  ▶ Ver vídeo de apoio
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
