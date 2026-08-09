"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { initials } from "@/lib/utils/initials";
import { createGameEvent, deleteGameEvent, updateGameScore } from "@/lib/actions/gameEvents";
import type { GameEventType, GoalType } from "@/lib/types/database";

const EVENT_GROUPS: { label: string; events: { type: GameEventType; icon: string }[] }[] = [
  {
    label: "Ofensivo",
    events: [
      { type: "Gol", icon: "⚽" },
      { type: "Assistência", icon: "🅰️" },
      { type: "Finalização certa", icon: "🎯" },
      { type: "Finalização errada", icon: "💨" },
      { type: "Cruzamento", icon: "↗️" },
      { type: "Escanteio", icon: "🚩" },
    ],
  },
  {
    label: "Defensivo",
    events: [
      { type: "Desarme", icon: "🛡️" },
      { type: "Interceptação", icon: "✋" },
      { type: "Defesa", icon: "🧤" },
      { type: "Lateral", icon: "↩️" },
    ],
  },
  {
    label: "Disciplina",
    events: [
      { type: "Falta", icon: "⚠️" },
      { type: "Cartão amarelo", icon: "🟨" },
      { type: "Cartão vermelho", icon: "🟥" },
      { type: "Impedimento", icon: "🚫" },
      { type: "Lesão", icon: "🤕" },
    ],
  },
  {
    label: "Pênalti",
    events: [
      { type: "Pênalti sofrido", icon: "🎯" },
      { type: "Pênalti perdido", icon: "❌" },
      { type: "Pênalti defendido", icon: "🧤" },
    ],
  },
  {
    label: "Passe",
    events: [
      { type: "Passe certo", icon: "✅" },
      { type: "Passe errado", icon: "↪️" },
    ],
  },
];

const GOAL_TYPES: GoalType[] = ["Normal", "Pênalti", "Cabeça", "Fora da área", "Contra"];

const EVENT_ICONS: Record<GameEventType, string> = Object.fromEntries(
  EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.type, e.icon])),
) as Record<GameEventType, string>;

export interface RosterAthlete {
  id: string;
  full_name: string;
  jersey_num: number | null;
  photo_color: string | null;
}

export interface GameEventRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  event_type: GameEventType;
  goal_type: GoalType | null;
  minute: number | null;
  created_at: string;
}

export function GameSumulaClient({
  gameId,
  roster,
  initialEvents,
  initialOurScore,
  initialOpponentScore,
}: {
  gameId: string;
  roster: RosterAthlete[];
  initialEvents: GameEventRow[];
  initialOurScore: number | null;
  initialOpponentScore: number | null;
}) {
  const router = useRouter();
  const [activeAthlete, setActiveAthlete] = useState<RosterAthlete | null>(null);
  const [pendingGoal, setPendingGoal] = useState(false);
  const [activeGroup, setActiveGroup] = useState(EVENT_GROUPS[0].label);
  const [minute, setMinute] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [ourScore, setOurScore] = useState(initialOurScore ?? "");
  const [opponentScore, setOpponentScore] = useState(initialOpponentScore ?? "");
  const [savingScore, setSavingScore] = useState(false);

  async function logEvent(eventType: GameEventType, goalType?: GoalType) {
    if (!activeAthlete) return;
    setSaving(eventType);
    const formData = new FormData();
    formData.set("gameId", gameId);
    formData.set("athleteId", activeAthlete.id);
    formData.set("eventType", eventType);
    if (goalType) formData.set("goalType", goalType);
    if (minute) formData.set("minute", minute);
    const result = await createGameEvent(formData);
    setSaving(null);
    setPendingGoal(false);
    if (!result.error) {
      setFeedback(`${EVENT_ICONS[eventType]} ${eventType} registrado para ${activeAthlete.full_name}`);
      router.refresh();
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    await deleteGameEvent(eventId, gameId);
    router.refresh();
  }

  async function handleSaveScore() {
    setSavingScore(true);
    await updateGameScore(
      gameId,
      ourScore === "" ? null : Number(ourScore),
      opponentScore === "" ? null : Number(opponentScore),
    );
    setSavingScore(false);
    router.refresh();
  }

  const sortedEvents = [...initialEvents].sort((a, b) => {
    if (a.minute != null && b.minute != null) return a.minute - b.minute;
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className="text-xs font-bold text-ink-soft uppercase">Nós</span>
          <input
            type="number"
            min={0}
            value={ourScore}
            onChange={(e) => setOurScore(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-16 text-center text-2xl font-display border border-line rounded-sm py-1.5"
          />
          <span className="text-xl font-display text-ink-faint">×</span>
          <input
            type="number"
            min={0}
            value={opponentScore}
            onChange={(e) => setOpponentScore(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-16 text-center text-2xl font-display border border-line rounded-sm py-1.5"
          />
          <span className="text-xs font-bold text-ink-soft uppercase">Adversário</span>
          <Button variant="solid" size="sm" onClick={handleSaveScore} disabled={savingScore}>
            {savingScore ? "Salvando…" : "Salvar placar"}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold mb-3">Toque no atleta para lançar um evento</h3>
        {roster.length === 0 ? (
          <EmptyState icon="👥" message="Nenhum atleta nesse time." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {roster.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setActiveAthlete(a);
                  setPendingGoal(false);
                  setActiveGroup(EVENT_GROUPS[0].label);
                  setMinute("");
                }}
                className="flex items-center gap-2.5 px-3 py-3 rounded-md border border-line bg-white hover:border-pitch-dark text-left"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-sm shrink-0"
                  style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                >
                  {a.jersey_num ?? initials(a.full_name)}
                </div>
                <span className="text-sm font-semibold truncate">{a.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold mb-3">Eventos da partida</h3>
        {sortedEvents.length === 0 ? (
          <EmptyState icon="📋" message="Nenhum evento registrado ainda." />
        ) : (
          <div className="flex flex-col">
            {sortedEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0"
              >
                <span className="text-lg w-7 text-center shrink-0">{EVENT_ICONS[ev.event_type]}</span>
                <div className="flex-1 min-w-0">
                  <b className="text-sm block truncate">
                    {ev.event_type}
                    {ev.goal_type && ev.goal_type !== "Normal" ? ` (${ev.goal_type})` : ""}
                  </b>
                  <span className="text-xs text-ink-faint">
                    {ev.athlete_name}
                    {ev.minute != null ? ` · ${ev.minute}'` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(ev.id)}
                  className="text-ink-faint hover:text-clay text-[11px] leading-none"
                  aria-label="Remover evento"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!activeAthlete}
        onClose={() => setActiveAthlete(null)}
        title={activeAthlete?.full_name ?? ""}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
              Minuto (opcional)
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="w-16 px-2 py-1.5 border border-line rounded-sm text-sm"
            />
          </div>

          {feedback && (
            <div className="text-[12.5px] font-semibold text-pitch-dark bg-chalk border border-line rounded-sm px-3 py-2">
              ✓ {feedback}
            </div>
          )}

          {pendingGoal ? (
            <>
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                Tipo do gol
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GOAL_TYPES.map((gt) => (
                  <button
                    key={gt}
                    type="button"
                    disabled={!!saving}
                    onClick={() => logEvent("Gol", gt)}
                    className="px-3 py-3 rounded-md border border-line bg-white hover:border-pitch-dark font-semibold text-sm disabled:opacity-50"
                  >
                    {gt}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPendingGoal(false)}>
                ← Voltar
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {EVENT_GROUPS.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setActiveGroup(g.label)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                      activeGroup === g.label
                        ? "bg-pitch-dark text-chalk border-pitch-dark"
                        : "border-line text-ink-soft"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(EVENT_GROUPS.find((g) => g.label === activeGroup)?.events ?? []).map((e) => (
                  <button
                    key={e.type}
                    type="button"
                    disabled={!!saving}
                    onClick={() => (e.type === "Gol" ? setPendingGoal(true) : logEvent(e.type))}
                    className="flex flex-col items-center gap-1 px-3 py-3.5 rounded-md border border-line bg-white hover:border-pitch-dark font-semibold text-[12.5px] disabled:opacity-50"
                  >
                    <span className="text-xl">{e.icon}</span>
                    {e.type}
                  </button>
                ))}
              </div>
            </>
          )}

          <Button variant="outline" onClick={() => setActiveAthlete(null)}>
            Fechar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
