import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewCompetitionModal } from "@/components/games/NewCompetitionModal";
import { DeleteCompetitionButton } from "@/components/games/DeleteCompetitionButton";
import { NewGameModal } from "@/components/games/NewGameModal";
import { DeleteGameButton } from "@/components/games/DeleteGameButton";

export default async function JogosPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: competitions }, { data: games }, { data: athletes }, { data: partnerClubs }] =
    await Promise.all([
      supabase
        .from("competitions")
        .select("id, name")
        .eq("club_id", profile!.clubId)
        .order("name", { ascending: true }),
      supabase
        .from("games")
        .select(
          "id, competition_id, opponent, scheduled_date, scheduled_time, location, target_type, target_team, our_score, opponent_score, athletes(full_name)",
        )
        .eq("club_id", profile!.clubId)
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("athletes")
        .select("id, full_name")
        .eq("club_id", profile!.clubId)
        .order("full_name", { ascending: true }),
      supabase
        .from("partner_clubs")
        .select("name")
        .eq("club_id", profile!.clubId)
        .order("name", { ascending: true }),
    ]);

  const teams = (partnerClubs ?? []).map((c) => c.name);

  const gamesByCompetition = new Map<string, NonNullable<typeof games>>();
  for (const g of games ?? []) {
    const list = gamesByCompetition.get(g.competition_id) ?? [];
    list.push(g);
    gamesByCompetition.set(g.competition_id, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-[28px] m-0">Jogos</h2>
          <div className="text-xs text-ink-faint mt-0.5">
            Calendário de jogos organizado por competição
          </div>
        </div>
        <NewCompetitionModal />
      </div>

      {!competitions || competitions.length === 0 ? (
        <Card>
          <EmptyState icon="🏆" message="Nenhuma competição cadastrada ainda." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {competitions.map((c) => {
            const competitionGames = gamesByCompetition.get(c.id) ?? [];
            return (
              <Card key={c.id}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <b className="text-[15px]">{c.name}</b>
                  <div className="flex items-center gap-1.5">
                    <NewGameModal
                      competitionId={c.id}
                      competitionName={c.name}
                      athletes={athletes ?? []}
                      teams={teams}
                      partnerClubNames={teams}
                    />
                    <DeleteCompetitionButton competitionId={c.id} />
                  </div>
                </div>

                {competitionGames.length === 0 ? (
                  <p className="text-xs text-ink-faint m-0">Nenhum jogo cadastrado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {competitionGames.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-3 py-2 border-b border-line last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <b className="text-sm block">
                            vs. {g.opponent}
                            {g.our_score != null && g.opponent_score != null
                              ? ` · ${g.our_score} × ${g.opponent_score}`
                              : ""}
                          </b>
                          <span className="text-xs text-ink-faint">
                            {g.scheduled_date}
                            {g.scheduled_time ? ` às ${g.scheduled_time.slice(0, 5)}` : ""}
                            {g.location ? ` · ${g.location}` : ""}
                          </span>
                        </div>
                        <Badge tone={g.target_type === "team" ? "sky" : "amber"}>
                          {g.target_type === "team"
                            ? g.target_team
                            : (g.athletes as unknown as { full_name: string } | null)?.full_name}
                        </Badge>
                        <Link href={`/jogos/${g.id}`}>
                          <Button variant="ghost" size="sm">
                            Súmula
                          </Button>
                        </Link>
                        <DeleteGameButton gameId={g.id} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
