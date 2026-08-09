import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { GameSumulaClient } from "@/components/games/GameSumulaClient";
import type { GameEventType, GoalType } from "@/lib/types/database";

export default async function GameSumulaPage({
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
      "id, opponent, scheduled_date, scheduled_time, location, target_type, target_athlete_id, target_team, target_category, our_score, opponent_score, lineup_published_at, competitions(name)",
    )
    .eq("id", gameId)
    .eq("club_id", profile!.clubId)
    .single();

  if (!game) notFound();

  let rosterQuery =
    game.target_type === "team"
      ? supabase
          .from("athletes")
          .select("id, full_name, jersey_num, photo_color")
          .eq("club_id", profile!.clubId)
          .eq("team", game.target_team ?? "")
          .order("full_name", { ascending: true })
      : supabase
          .from("athletes")
          .select("id, full_name, jersey_num, photo_color")
          .eq("club_id", profile!.clubId)
          .eq("id", game.target_athlete_id ?? "");
  if (game.target_type === "team" && game.target_category) {
    rosterQuery = rosterQuery.eq("category", game.target_category);
  }

  const [{ data: roster }, { data: events }] = await Promise.all([
    rosterQuery,
    supabase
      .from("game_events")
      .select("id, athlete_id, event_type, goal_type, minute, created_at, athletes(full_name)")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
  ]);

  const competitionName = (game.competitions as unknown as { name: string } | null)?.name ?? "";

  return (
    <div>
      <div className="mb-5">
        <Link href="/jogos" className="text-xs font-semibold text-ink-faint hover:text-pitch-dark">
          ← Jogos
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-1.5">
          <div>
            <h2 className="text-[26px] m-0">Súmula — vs. {game.opponent}</h2>
            <div className="text-xs text-ink-faint mt-0.5">
              {competitionName} · {game.scheduled_date}
              {game.scheduled_time ? ` às ${game.scheduled_time.slice(0, 5)}` : ""}
              {game.location ? ` · ${game.location}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={game.target_type === "team" ? "sky" : "amber"}>
              {game.target_type === "team"
                ? `${game.target_team} · ${game.target_category ?? "—"}`
                : "Individual"}
            </Badge>
            <Link
              href={`/jogos/${game.id}/escalacao`}
              className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
            >
              📋 Escalação{game.lineup_published_at ? " · publicada" : ""}
            </Link>
          </div>
        </div>
      </div>

      <GameSumulaClient
        gameId={game.id}
        roster={roster ?? []}
        initialOurScore={game.our_score}
        initialOpponentScore={game.opponent_score}
        initialEvents={(events ?? []).map((e) => ({
          id: e.id,
          athlete_id: e.athlete_id,
          athlete_name: (e.athletes as unknown as { full_name: string } | null)?.full_name ?? "—",
          event_type: e.event_type as GameEventType,
          goal_type: e.goal_type as GoalType | null,
          minute: e.minute,
          created_at: e.created_at,
        }))}
      />
    </div>
  );
}
