import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeletePlayButton } from "@/components/plays/DeletePlayButton";
import { SPORT_LABELS, type PlayFrame, type PlaySportType } from "@/lib/types/plays";

export default async function PlaysPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: plays } = await supabase
    .from("plays")
    .select("id, name, target_type, target_team, video_url, frames, sport_type, athletes(full_name)")
    .eq("club_id", profile!.clubId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-[28px] m-0">Mesa Tática</h2>
          <div className="text-xs text-ink-faint mt-0.5">Jogadas e formações do clube</div>
        </div>
        <Link
          href="/plays/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold transition-colors px-3.5 py-2.5 text-sm bg-pitch-dark text-white border-pitch-dark hover:bg-pitch-light"
        >
          + Nova jogada
        </Link>
      </div>

      {!plays || plays.length === 0 ? (
        <Card>
          <EmptyState icon="🎯" message="Nenhuma jogada cadastrada ainda." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3.5">
          {plays.map((p) => {
            const frames = (p.frames as unknown as PlayFrame[]) ?? [];
            const target =
              p.target_type === "team"
                ? p.target_team
                : (p.athletes as unknown as { full_name: string } | null)?.full_name;
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="m-0 text-[15px] font-bold">{p.name}</h4>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <Badge tone="dark">{SPORT_LABELS[p.sport_type as PlaySportType]}</Badge>
                    <Badge tone={p.target_type === "team" ? "sky" : "amber"}>{target ?? "—"}</Badge>
                  </div>
                </div>
                <p className="text-xs text-ink-faint m-0 mb-3">
                  {frames.length} {frames.length === 1 ? "quadro" : "quadros"}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/plays/${p.id}`}
                    className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                  >
                    ✏️ Editar
                  </Link>
                  {p.video_url && (
                    <a
                      href={p.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
                    >
                      ▶ Ver vídeo
                    </a>
                  )}
                  <DeletePlayButton playId={p.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
