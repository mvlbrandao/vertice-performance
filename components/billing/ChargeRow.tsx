"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { setChargeStatus, deleteCharge } from "@/lib/actions/billing";
import type { ChargeStatus } from "@/lib/types/database";

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const STATUS_TONE: Record<ChargeStatus, "green" | "amber" | "clay" | "dark"> = {
  Pago: "green",
  Pendente: "amber",
  Atrasado: "clay",
  Cancelado: "dark",
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ChargeRow({
  id,
  athleteId,
  description,
  amountCents,
  competenceMonth,
  competenceYear,
  dueDate,
  status,
  canManage,
}: {
  id: string;
  athleteId: string;
  description: string;
  amountCents: number;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  status: ChargeStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function markPaid() {
    setPending(true);
    await setChargeStatus(id, athleteId, "Pago");
    setPending(false);
    router.refresh();
  }

  async function cancel() {
    setPending(true);
    await setChargeStatus(id, athleteId, "Cancelado");
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    await deleteCharge(id, athleteId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <b className="text-sm block">{description}</b>
        <span className="text-xs text-ink-faint">
          {MONTHS[competenceMonth - 1]}/{competenceYear} · vence {dueDate}
        </span>
      </div>
      <span className="font-mono text-sm font-semibold">{formatCents(amountCents)}</span>
      <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      {canManage && status !== "Pago" && status !== "Cancelado" && (
        <button
          type="button"
          onClick={markPaid}
          disabled={pending}
          className="text-[11px] font-semibold text-pitch-dark hover:underline disabled:opacity-50"
        >
          Marcar pago
        </button>
      )}
      {canManage && status === "Pendente" && (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-[11px] font-semibold text-ink-faint hover:text-clay disabled:opacity-50"
        >
          Cancelar
        </button>
      )}
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-ink-faint hover:text-clay text-[11px] leading-none"
          aria-label="Excluir lançamento"
        >
          ✕
        </button>
      )}
    </div>
  );
}
