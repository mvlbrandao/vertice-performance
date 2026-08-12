import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { computePlayerScore } from "@/lib/scoring";
import { getScoreHistory } from "@/lib/scoreHistoryPoints";
import { getAthleteChallengePoints } from "@/lib/challengePoints";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { initials } from "@/lib/utils/initials";
import { athleteLevelFor } from "@/lib/data/challengeTiers";
import { PrintButton } from "@/components/reports/PrintButton";
import { ReportScoreLine } from "@/components/reports/ReportScoreLine";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ATTRS: { key: "attack" | "defense" | "physical" | "mental" | "discipline" | "commitment" | "development"; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defesa" },
  { key: "physical", label: "Físico" },
  { key: "mental", label: "Mental" },
  { key: "discipline", label: "Disciplina" },
  { key: "commitment", label: "Compromisso" },
  { key: "development", label: "Desenvolvimento" },
];

export default async function AthleteReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { athleteId } = await params;
  const { desde } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // Período padrão: últimos 90 dias — um trimestre, que é o ciclo em que
  // faz sentido conversar com o responsável sobre evolução.
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const since = desde ?? ninetyDaysAgo.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("id", athleteId)
    .eq("club_id", profile!.clubId)
    .single();
  if (!athlete) notFound();

  const [
    score,
    scoreHistory,
    challengePoints,
    photoUrl,
    { data: club },
    { data: events },
    { data: injuries },
    { data: swotItems },
    { data: charges },
    { data: checkins },
  ] = await Promise.all([
    computePlayerScore(supabase, athleteId),
    getScoreHistory(supabase, athleteId),
    getAthleteChallengePoints(supabase, athleteId),
    resolveSignedUrl("athlete-photos", athlete.photo_url),
    supabase.from("clubs").select("name").eq("id", profile!.clubId).single(),
    supabase
      .from("game_events")
      .select("event_type, games(scheduled_date, opponent)")
      .eq("athlete_id", athleteId),
    supabase
      .from("athlete_injuries")
      .select("body_region, injury_type, severity, status, occurred_at, expected_return_date")
      .eq("athlete_id", athleteId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("athlete_swot_items")
      .select("category, description, status, target_trainings, trainings_done")
      .eq("athlete_id", athleteId)
      .order("category", { ascending: true }),
    supabase
      .from("athlete_charges")
      .select("status, amount_cents, discount_cents, due_date")
      .eq("athlete_id", athleteId)
      .gte("due_date", since),
    supabase
      .from("checkins")
      .select("training_done, diet_done, checkin_date")
      .eq("athlete_id", athleteId)
      .gte("checkin_date", since),
  ]);

  const inPeriod = (events ?? []).filter((e) => {
    const g = e.games as unknown as { scheduled_date: string } | null;
    return g && g.scheduled_date >= since && g.scheduled_date <= today;
  });
  const count = (t: string) => inPeriod.filter((e) => e.event_type === t).length;
  const gamesPlayed = new Set(
    inPeriod.map((e) => (e.games as unknown as { opponent: string }).opponent),
  ).size;

  const totalCheckins = checkins?.length ?? 0;
  const trainingPct = totalCheckins
    ? Math.round((checkins!.filter((c) => c.training_done).length / totalCheckins) * 100)
    : 0;
  const dietPct = totalCheckins
    ? Math.round((checkins!.filter((c) => c.diet_done).length / totalCheckins) * 100)
    : 0;

  const paid = (charges ?? []).filter((c) => c.status === "Pago");
  const open = (charges ?? []).filter((c) => c.status !== "Pago" && c.status !== "Cancelado");
  const level = athleteLevelFor(challengePoints);

  const first = scoreHistory[0];
  const delta = first ? score.overall - first.overall : 0;

  return (
    <div className="report-root max-w-[820px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
        <div>
          <h1 className="text-[24px] m-0">Relatório do atleta</h1>
          <p className="text-xs text-ink-faint m-0 mt-0.5">
            Período de {since} a {today}. Use Imprimir → Salvar como PDF pra enviar ao responsável.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="border border-line rounded-lg overflow-hidden bg-white">
        {/* Cabeçalho */}
        <div className="bg-pitch-dark text-chalk px-6 py-5 flex items-center gap-4 flex-wrap">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={athlete.full_name} className="w-16 h-16 rounded-lg object-cover border-2 border-amber" />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center font-display text-2xl border-2 border-amber"
              style={{ background: athlete.photo_color ?? "#111", color: "#FFD600" }}
            >
              {initials(athlete.full_name)}
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <span className="text-[11px] uppercase tracking-wider text-amber font-bold">
              {club?.name ?? "Vértice Performance"}
            </span>
            <h2 className="m-0 text-xl font-extrabold">{athlete.full_name}</h2>
            <span className="text-[12px] text-white/60">
              {[athlete.category, athlete.position?.join(", "), athlete.team].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="text-center">
            <b className="font-display text-[34px] text-amber block leading-none">{score.overall}</b>
            <span className="text-[10px] uppercase tracking-wide text-white/50">Score geral</span>
            {delta !== 0 && (
              <span className={`block text-[11px] font-bold ${delta > 0 ? "text-[#8CC9A3]" : "text-[#E68A7A]"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} no período
              </span>
            )}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Score por dimensão */}
          <section>
            <h3 className="text-[15px] m-0 mb-3">Score por dimensão</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {ATTRS.map((a) => (
                <div key={a.key} className="flex items-center gap-2.5">
                  <span className="w-[112px] text-[12px] text-ink-soft shrink-0">{a.label}</span>
                  <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                    <div className="h-full bg-pitch-dark rounded-full" style={{ width: `${score[a.key]}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-[12px]">{score[a.key]}</span>
                </div>
              ))}
            </div>
            {scoreHistory.length >= 2 && (
              <div className="mt-4">
                <ReportScoreLine points={scoreHistory.map((p) => ({ date: p.date, value: p.overall }))} />
              </div>
            )}
          </section>

          {/* Números do período */}
          <section>
            <h3 className="text-[15px] m-0 mb-3">Números do período</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { l: "Jogos", v: gamesPlayed },
                { l: "Gols", v: count("Gol") },
                { l: "Assistências", v: count("Assistência") },
                { l: "Defesas", v: count("Defesa") },
                { l: "Amarelos", v: count("Cartão amarelo") },
                { l: "Check-ins", v: totalCheckins },
              ].map((k) => (
                <div key={k.l} className="border border-line rounded-md px-3 py-2.5 text-center">
                  <b className="font-mono text-[18px] block">{k.v}</b>
                  <span className="text-[10.5px] text-ink-faint uppercase tracking-wide">{k.l}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="flex items-center gap-2.5">
                <span className="w-[112px] text-[12px] text-ink-soft shrink-0">Adesão a treinos</span>
                <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-amber rounded-full" style={{ width: `${trainingPct}%` }} />
                </div>
                <span className="w-9 text-right font-mono text-[12px]">{trainingPct}%</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-[112px] text-[12px] text-ink-soft shrink-0">Adesão à dieta</span>
                <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-amber rounded-full" style={{ width: `${dietPct}%` }} />
                </div>
                <span className="w-9 text-right font-mono text-[12px]">{dietPct}%</span>
              </div>
            </div>
          </section>

          {/* Plano de evolução */}
          <section className="break-inside-avoid">
            <h3 className="text-[15px] m-0 mb-3">Plano de evolução (SWOT)</h3>
            {!swotItems || swotItems.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint m-0">Nenhum ponto registrado no ciclo atual.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {swotItems.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
                    <span className="font-bold w-[104px] shrink-0 text-ink-soft">{s.category}</span>
                    <span className="flex-1">{s.description}</span>
                    <span className="text-ink-faint font-mono text-[11.5px] shrink-0">
                      {s.trainings_done}/{s.target_trainings} treinos
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Lesões */}
          <section className="break-inside-avoid">
            <h3 className="text-[15px] m-0 mb-3">Lesões no período</h3>
            {!injuries || injuries.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint m-0">Nenhuma lesão registrada. 👏</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {injuries.map((inj, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
                    <span className="font-bold w-[104px] shrink-0">{inj.body_region}</span>
                    <span className="flex-1">
                      {inj.injury_type} · {inj.severity}
                    </span>
                    <span className="text-ink-faint shrink-0">
                      {inj.occurred_at} · {inj.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Desafios e financeiro */}
          <section className="break-inside-avoid grid sm:grid-cols-2 gap-5">
            <div>
              <h3 className="text-[15px] m-0 mb-2">Desafios</h3>
              <p className="text-[12.5px] m-0">
                <b>{challengePoints} pontos</b> · nível {level.icon} {level.label}
              </p>
            </div>
            <div>
              <h3 className="text-[15px] m-0 mb-2">Financeiro do período</h3>
              <p className="text-[12.5px] m-0">
                {paid.length} {paid.length === 1 ? "parcela paga" : "parcelas pagas"} ·{" "}
                <b>{formatCents(paid.reduce((s, c) => s + c.amount_cents - (c.discount_cents ?? 0), 0))}</b>
              </p>
              {open.length > 0 && (
                <p className="text-[12.5px] m-0 mt-1 text-clay">
                  {open.length} em aberto ·{" "}
                  {formatCents(open.reduce((s, c) => s + c.amount_cents - (c.discount_cents ?? 0), 0))}
                </p>
              )}
            </div>
          </section>

          <p className="text-[10.5px] text-ink-faint m-0 pt-3 border-t border-line">
            Relatório gerado por {club?.name ?? "Vértice Performance"} em{" "}
            {new Date().toLocaleDateString("pt-BR")}. Score calculado a partir de jogos, treinos,
            check-ins e acompanhamento técnico do período.
          </p>
        </div>
      </div>
    </div>
  );
}
