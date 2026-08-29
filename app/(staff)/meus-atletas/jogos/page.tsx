import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const EVENT_ICON: Record<string, string> = {
  Gol: "⚽",
  Assistência: "🅰️",
  Falta: "⚠️",
  "Cartão amarelo": "🟨",
  "Cartão vermelho": "🟥",
  Defesa: "🧤",
};

/**
 * Catálogo só-leitura: a RLS de games/game_lineups/game_events (0067) já
 * filtra pra jogos com pelo menos um atleta concedido, e os eventos vêm só
 * dos atletas concedidos — súmula completa, escalação e edição continuam
 * exclusivas do treinador.
 */
export default async function StaffJogosPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select(
      "id, opponent, scheduled_date, scheduled_time, location, our_score, opponent_score, competitions(name)",
    )
    .eq("club_id", staff.clubId)
    .order("scheduled_date", { ascending: false });

  const gameIds = (games ?? []).map((g) => g.id);
  const [{ data: lineups }, { data: events }] =
    gameIds.length > 0
      ? await Promise.all([
          supabase
            .from("game_lineups")
            .select("game_id, athlete_id, status")
            .in("game_id", gameIds),
          supabase
            .from("game_events")
            .select("game_id, athlete_id, event_type, minute")
            .in("game_id", gameIds),
        ])
      : [{ data: null }, { data: null }];

  const athleteIds = [
    ...new Set([...(lineups ?? []).map((l) => l.athlete_id), ...(events ?? []).map((e) => e.athlete_id)]),
  ];
  const { data: athletes } =
    athleteIds.length > 0
      ? await supabase.from("athletes").select("id, full_name").in("id", athleteIds)
      : { data: [] };
  const nameById = new Map((athletes ?? []).map((a) => [a.id, a.full_name]));

  const lineupsByGame = new Map<string, NonNullable<typeof lineups>>();
  for (const l of lineups ?? []) {
    const list = lineupsByGame.get(l.game_id) ?? [];
    list.push(l);
    lineupsByGame.set(l.game_id, list);
  }
  const eventsByGame = new Map<string, NonNullable<typeof events>>();
  for (const e of events ?? []) {
    const list = eventsByGame.get(e.game_id) ?? [];
    list.push(e);
    eventsByGame.set(e.game_id, list);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[28px] m-0">Jogos</h2>
        <div className="text-xs text-ink-faint mt-0.5">
          Jogos dos atletas que você acompanha
        </div>
      </div>

      {!games || games.length === 0 ? (
        <Card>
          <EmptyState icon="🏆" message="Nenhum jogo com atletas que você acompanha ainda." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {games.map((g) => {
            const gameLineups = lineupsByGame.get(g.id) ?? [];
            const gameEvents = eventsByGame.get(g.id) ?? [];
            return (
              <Card key={g.id}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div>
                    <b className="text-sm block">
                      vs. {g.opponent}
                      {(g.competitions as unknown as { name: string } | null)?.name
                        ? ` · ${(g.competitions as unknown as { name: string }).name}`
                        : ""}
                    </b>
                    <span className="text-xs text-ink-faint">
                      {g.scheduled_date}
                      {g.scheduled_time ? ` às ${g.scheduled_time.slice(0, 5)}` : ""}
                      {g.location ? ` · ${g.location}` : ""}
                    </span>
                  </div>
                  {g.our_score != null && g.opponent_score != null && (
                    <Badge tone="green">
                      {g.our_score} × {g.opponent_score}
                    </Badge>
                  )}
                </div>
                {gameLineups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {gameLineups.map((l, i) => (
                      <Badge key={i} tone={l.status === "Titular" ? "green" : "sky"}>
                        {nameById.get(l.athlete_id) ?? "—"} · {l.status}
                      </Badge>
                    ))}
                  </div>
                )}
                {gameEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {gameEvents.map((e, i) => (
                      <Badge key={i} tone="amber">
                        {EVENT_ICON[e.event_type] ?? "•"} {nameById.get(e.athlete_id) ?? "—"} ·{" "}
                        {e.event_type}
                        {e.minute != null ? ` ${e.minute}'` : ""}
                      </Badge>
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
