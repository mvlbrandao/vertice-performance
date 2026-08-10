import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitChallengeModal } from "@/components/challenges/SubmitChallengeModal";
import { CHALLENGE_TIER_ICON, athleteLevelFor } from "@/lib/data/challengeTiers";

const SUBMISSION_TONE: Record<string, "amber" | "green" | "clay"> = {
  Pendente: "amber",
  Aprovado: "green",
  Rejeitado: "clay",
};

export default async function AthleteDesafiosPage() {
  const profile = await getSessionProfile();
  if (!profile?.athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();
  const [{ data: challenges }, { data: submissions }] = await Promise.all([
    supabase
      .from("challenges")
      .select("*")
      .eq("club_id", profile.clubId)
      .eq("status", "Ativo")
      .or(`athlete_id.is.null,athlete_id.eq.${profile.athleteId}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("challenge_submissions")
      .select("*, challenges(title, points, tier)")
      .eq("athlete_id", profile.athleteId)
      .order("submitted_at", { ascending: false }),
  ]);

  const submittedChallengeIds = new Set(
    (submissions ?? [])
      .filter((s) => s.status === "Pendente" || s.status === "Aprovado")
      .map((s) => s.challenge_id),
  );
  const availableChallenges = (challenges ?? []).filter((c) => !submittedChallengeIds.has(c.id));

  const totalPoints = (submissions ?? [])
    .filter((s) => s.status === "Aprovado")
    .reduce((sum, s) => sum + (s.points_awarded ?? 0), 0);
  const level = athleteLevelFor(totalPoints);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[28px] m-0">Desafios</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Complete desafios extras, poste no Instagram e ganhe pontos de destaque.
        </div>
      </div>

      <Card className="mb-5 bg-pitch-dark text-chalk flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0 border-2"
          style={{ borderColor: level.color }}
        >
          {level.icon}
        </div>
        <div>
          <b className="block text-lg">
            {totalPoints} pontos · {level.label}
          </b>
          {level.nextThreshold !== null ? (
            <span className="text-xs text-white/60">
              Faltam {level.nextThreshold - totalPoints} pontos pro próximo nível
            </span>
          ) : (
            <span className="text-xs text-white/60">Nível máximo alcançado 🎉</span>
          )}
        </div>
      </Card>

      <h3 className="text-sm mb-2">Disponíveis</h3>
      <Card className="mb-5">
        {availableChallenges.length === 0 ? (
          <EmptyState icon="🏆" message="Nenhum desafio disponível no momento." />
        ) : (
          availableChallenges.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Badge tone="amber">
                    {CHALLENGE_TIER_ICON[c.tier]} {c.tier} · {c.points} pts
                  </Badge>
                </div>
                <b className="text-sm block">{c.title}</b>
                <span className="text-[12.5px] text-ink-soft">{c.description}</span>
              </div>
              <SubmitChallengeModal challengeId={c.id} challengeTitle={c.title} />
            </div>
          ))
        )}
      </Card>

      <h3 className="text-sm mb-2">Meus envios</h3>
      <Card>
        {!submissions || submissions.length === 0 ? (
          <EmptyState icon="📸" message="Nenhum desafio enviado ainda." />
        ) : (
          submissions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap"
            >
              <div>
                <b className="text-sm block">
                  {(s.challenges as unknown as { title: string } | null)?.title ?? "Desafio"}
                </b>
                <span className="text-xs text-ink-faint">
                  {new Date(s.submitted_at).toLocaleDateString("pt-BR")}
                  {s.review_notes ? ` · ${s.review_notes}` : ""}
                </span>
              </div>
              <Badge tone={SUBMISSION_TONE[s.status]}>
                {s.status}
                {s.status === "Aprovado" ? ` (+${s.points_awarded} pts)` : ""}
              </Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
