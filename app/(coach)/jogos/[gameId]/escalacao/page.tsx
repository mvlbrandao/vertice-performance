import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { LineupClient } from "@/components/games/LineupClient";

export default async function GameLineupPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select(
      "id, opponent, scheduled_date, scheduled_time, target_type, target_athlete_id, target_team, target_category, lineup_play_id, lineup_video_url, lineup_published_at",
    )
    .eq("id", gameId)
    .eq("club_id", profile!.clubId)
    .single();

  if (!game) notFound();

  let rosterQuery =
    game.target_type === "team"
      ? supabase
          .from("athletes")
          .select("id, full_name, jersey_num, photo_color, position")
          .eq("club_id", profile!.clubId)
          .eq("team", game.target_team ?? "")
          .order("full_name", { ascending: true })
      : supabase
          .from("athletes")
          .select("id, full_name, jersey_num, photo_color, position")
          .eq("club_id", profile!.clubId)
          .eq("id", game.target_athlete_id ?? "");
  if (game.target_type === "team" && game.target_category) {
    rosterQuery = rosterQuery.eq("category", game.target_category);
  }

  const [{ data: roster }, { data: lineup }, { data: plays }] = await Promise.all([
    rosterQuery,
    supabase
      .from("game_lineups")
      .select("athlete_id, status, notes")
      .eq("game_id", gameId),
    supabase
      .from("plays")
      .select("id, name")
      .eq("club_id", profile!.clubId)
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/jogos/${gameId}`}
          className="text-xs font-semibold text-ink-faint hover:text-pitch-dark"
        >
          ← Súmula
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-1.5">
          <div>
            <h2 className="text-[26px] m-0">Escalação — vs. {game.opponent}</h2>
            <div className="text-xs text-ink-faint mt-0.5">
              {game.scheduled_date}
              {game.scheduled_time ? ` às ${game.scheduled_time.slice(0, 5)}` : ""}
            </div>
          </div>
          <Badge tone={game.lineup_published_at ? "green" : "amber"}>
            {game.lineup_published_at ? "✅ Publicada" : "📝 Rascunho"}
          </Badge>
        </div>
      </div>

      <LineupClient
        gameId={game.id}
        roster={roster ?? []}
        lineup={lineup ?? []}
        plays={plays ?? []}
        initialPlayId={game.lineup_play_id}
        initialVideoUrl={game.lineup_video_url}
        published={!!game.lineup_published_at}
      />
    </div>
  );
}
