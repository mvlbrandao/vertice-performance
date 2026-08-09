"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { setSwotItemStatus, deleteSwotItem } from "@/lib/actions/swot";
import type { SwotAuthorRole, SwotItemStatus } from "@/lib/types/database";

function MiniBar({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="w-16 text-[11px] text-ink-faint shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-deep to-amber"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-[10.5px] text-ink-soft">
        {done}/{target}
      </span>
    </div>
  );
}

export function SwotItemCard({
  id,
  athleteId,
  description,
  authorRole,
  status,
  targetMeetings,
  targetTrainings,
  meetingsDone,
  trainingsDone,
  evidenceCount = 0,
  canManage,
}: {
  id: string;
  athleteId: string;
  description: string;
  authorRole: SwotAuthorRole;
  status: SwotItemStatus;
  targetMeetings: number;
  targetTrainings: number;
  meetingsDone: number;
  trainingsDone: number;
  evidenceCount?: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const hasTargets = targetMeetings > 0 || targetTrainings > 0;
  const metaReached =
    hasTargets && meetingsDone >= targetMeetings && trainingsDone >= targetTrainings;

  async function toggleStatus() {
    setPending(true);
    await setSwotItemStatus(id, athleteId, status === "Concluído" ? "Aberto" : "Concluído");
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    await deleteSwotItem(id, athleteId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="border border-line rounded-md p-3 bg-white">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[13px] m-0 flex-1">{description}</p>
        {canManage && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-ink-faint hover:text-clay text-[11px] leading-none shrink-0"
            aria-label="Remover ponto"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge tone="dark">{authorRole === "coach" ? "Treinador" : "Atleta"}</Badge>
        {status === "Concluído" && <Badge tone="green">✅ Concluído</Badge>}
        {status === "Aberto" && metaReached && (
          <Badge tone="amber">🎯 Meta atingida — reavaliar</Badge>
        )}
        {evidenceCount > 0 && (
          <Badge tone="sky">
            📎 {evidenceCount} {evidenceCount === 1 ? "evidência vinculada" : "evidências vinculadas"}
          </Badge>
        )}
      </div>
      {hasTargets && (
        <div className="mb-2">
          {targetMeetings > 0 && (
            <MiniBar label="Encontros" done={meetingsDone} target={targetMeetings} />
          )}
          {targetTrainings > 0 && (
            <MiniBar label="Treinos" done={trainingsDone} target={targetTrainings} />
          )}
        </div>
      )}
      {canManage && (
        <button
          type="button"
          onClick={toggleStatus}
          disabled={pending}
          className="text-[11px] font-semibold text-pitch-dark hover:underline disabled:opacity-50"
        >
          {status === "Concluído" ? "Reabrir" : "Marcar como concluído"}
        </button>
      )}
    </div>
  );
}
