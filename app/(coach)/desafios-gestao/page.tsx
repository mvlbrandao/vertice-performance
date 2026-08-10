import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewChallengeModal } from "@/components/challenges/NewChallengeModal";
import { ReviewSubmissionRow } from "@/components/challenges/ReviewSubmissionRow";
import { ArchiveChallengeButton } from "@/components/challenges/ArchiveChallengeButton";
import { CHALLENGE_TIER_ICON } from "@/lib/data/challengeTiers";
import { athleteLevelFor } from "@/lib/data/challengeTiers";

export default async function DesafiosPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: athletes }, { data: challenges }, { data: submissions }] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("challenges")
      .select("*, athletes(full_name)")
      .eq("club_id", profile!.clubId)
      .eq("status", "Ativo")
      .order("created_at", { ascending: false }),
    supabase
      .from("challenge_submissions")
      .select("*, challenges(title, points), athletes(full_name)")
      .eq("club_id", profile!.clubId)
      .order("submitted_at", { ascending: false }),
  ]);

  const pending = (submissions ?? []).filter((s) => s.status === "Pendente");

  const pointsByAthlete = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (s.status !== "Aprovado") continue;
    pointsByAthlete.set(s.athlete_id, (pointsByAthlete.get(s.athlete_id) ?? 0) + (s.points_awarded ?? 0));
  }
  const ranking = (athletes ?? [])
    .map((a) => ({ ...a, points: pointsByAthlete.get(a.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[28px] m-0">Desafios</h1>
          <div className="text-xs text-ink-faint mt-0.5">
            Desafios extras pra engajar os atletas — eles postam a evidência no Instagram e você
            aprova os pontos.
          </div>
        </div>
        <NewChallengeModal athletes={athletes ?? []} />
      </div>

      {pending.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm mb-2">Pendentes de avaliação ({pending.length})</h3>
          <div className="flex flex-col gap-2.5">
            {pending.map((s) => (
              <ReviewSubmissionRow
                key={s.id}
                submissionId={s.id}
                athleteName={
                  (s.athletes as unknown as { full_name: string } | null)?.full_name ?? "Atleta"
                }
                challengeTitle={
                  (s.challenges as unknown as { title: string } | null)?.title ?? "Desafio"
                }
                points={(s.challenges as unknown as { points: number } | null)?.points ?? 0}
                instagramUrl={s.instagram_url}
                notes={s.notes}
                submittedAt={s.submitted_at}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div>
          <h3 className="text-sm mb-2">Desafios ativos</h3>
          <Card>
            {!challenges || challenges.length === 0 ? (
              <EmptyState icon="🏆" message="Nenhum desafio criado ainda." />
            ) : (
              challenges.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge tone="amber">
                        {CHALLENGE_TIER_ICON[c.tier]} {c.tier} · {c.points} pts
                      </Badge>
                      {c.athletes && (
                        <Badge tone="sky">
                          {(c.athletes as unknown as { full_name: string }).full_name}
                        </Badge>
                      )}
                      {c.target_position && <Badge tone="dark">{c.target_position}</Badge>}
                    </div>
                    <b className="text-sm block">{c.title}</b>
                    <span className="text-[12.5px] text-ink-soft">{c.description}</span>
                  </div>
                  <ArchiveChallengeButton challengeId={c.id} />
                </div>
              ))
            )}
          </Card>
        </div>

        <div>
          <h3 className="text-sm mb-2">Pontuação por atleta</h3>
          <Card>
            {ranking.length === 0 ? (
              <EmptyState icon="⭐" message="Nenhum atleta ativo ainda." />
            ) : (
              ranking.map((a) => {
                const level = athleteLevelFor(a.points);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 border-b border-line last:border-b-0 text-sm"
                  >
                    <span>{a.full_name}</span>
                    <span className="flex items-center gap-1.5">
                      <b className="font-mono">{a.points} pts</b>
                      <Badge tone="dark">
                        {level.icon} {level.label}
                      </Badge>
                    </span>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
