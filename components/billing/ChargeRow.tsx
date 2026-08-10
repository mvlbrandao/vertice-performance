"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { setChargeStatus, deleteCharge, updateChargeDueDate } from "@/lib/actions/billing";
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ChargeRow({
  id,
  athleteId,
  athleteName,
  description,
  amountCents,
  discountCents = 0,
  competenceMonth,
  competenceYear,
  dueDate,
  status,
  canManage,
}: {
  id: string;
  athleteId: string;
  athleteName?: string;
  description: string;
  amountCents: number;
  discountCents?: number;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  status: ChargeStatus;
  canManage: boolean;
}) {
  const netCents = amountCents - discountCents;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(dueDate);
  const isOverdue = status === "Atrasado" || (status === "Pendente" && dueDate < todayISO());

  async function markPaid() {
    setPending(true);
    await setChargeStatus(id, athleteId, "Pago");
    setPending(false);
    router.refresh();
  }

  async function undoPaid() {
    setPending(true);
    await setChargeStatus(id, athleteId, "Pendente");
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

  async function saveDueDate() {
    setPending(true);
    await updateChargeDueDate(id, athleteId, dateValue);
    setPending(false);
    setEditingDate(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 border-b border-line last:border-b-0">
      <div className="flex-1 min-w-0 sm:min-w-[160px]">
        {athleteName && (
          <Link
            href={`/athletes/${athleteId}/financeiro`}
            className="text-[11px] font-semibold text-pitch-dark hover:underline block mb-0.5"
          >
            {athleteName}
          </Link>
        )}
        <b className="text-sm block">{description}</b>
        {editingDate ? (
          <span className="inline-flex items-center gap-1.5 mt-1">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="px-1.5 py-0.5 border border-line rounded-sm text-xs"
            />
            <button
              type="button"
              onClick={saveDueDate}
              disabled={pending}
              className="text-[11px] font-semibold text-pitch-dark hover:underline"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setDateValue(dueDate);
                setEditingDate(false);
              }}
              className="text-[11px] text-ink-faint hover:underline"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span className="text-xs text-ink-faint">
            {MONTHS[competenceMonth - 1]}/{competenceYear} · vence {dueDate}
            {canManage && status !== "Pago" && status !== "Cancelado" && (
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                className="ml-1.5 text-pitch-dark hover:underline font-semibold"
              >
                editar
              </button>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap shrink-0">
        <span className="font-mono text-sm font-semibold text-right">
          {discountCents > 0 ? (
            <span className="block">
              <span className="text-ink-faint line-through text-xs block">
                {formatCents(amountCents)}
              </span>
              {formatCents(netCents)}
            </span>
          ) : (
            formatCents(amountCents)
          )}
        </span>
        <Badge tone={isOverdue ? "clay" : STATUS_TONE[status]}>
          {isOverdue ? "Atrasado" : status}
        </Badge>
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
        {canManage && status === "Pago" && (
          <button
            type="button"
            onClick={undoPaid}
            disabled={pending}
            className="text-[11px] font-semibold text-ink-faint hover:text-clay disabled:opacity-50"
          >
            Desfazer baixa
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
    </div>
  );
}
