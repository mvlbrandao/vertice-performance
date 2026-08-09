"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { setExpenseStatus, deleteExpense, updateExpenseDueDate } from "@/lib/actions/expenses";
import { EditExpenseModal } from "@/components/expenses/EditExpenseModal";
import type { ChargeStatus } from "@/lib/types/database";

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

export function ExpenseRow({
  id,
  description,
  categoryId,
  categoryName,
  categories,
  amountCents,
  notes,
  dueDate,
  status,
}: {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  categories: { id: string; name: string }[];
  amountCents: number;
  notes: string | null;
  dueDate: string;
  status: ChargeStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingExpense, setEditingExpense] = useState(false);
  const [dateValue, setDateValue] = useState(dueDate);
  const isOverdue = status === "Atrasado" || (status === "Pendente" && dueDate < todayISO());

  async function markPaid() {
    setPending(true);
    await setExpenseStatus(id, "Pago");
    setPending(false);
    router.refresh();
  }

  async function undoPaid() {
    setPending(true);
    await setExpenseStatus(id, "Pendente");
    setPending(false);
    router.refresh();
  }

  async function cancel() {
    setPending(true);
    await setExpenseStatus(id, "Cancelado");
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    await deleteExpense(id);
    setPending(false);
    router.refresh();
  }

  async function saveDueDate() {
    setPending(true);
    await updateExpenseDueDate(id, dateValue);
    setPending(false);
    setEditingDate(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <b className="text-sm">{description}</b>
          {categoryName && <Badge tone="sky">{categoryName}</Badge>}
          <button
            type="button"
            onClick={() => setEditingExpense(true)}
            className="text-[11px] font-semibold text-pitch-dark hover:underline"
          >
            editar
          </button>
        </div>
        <EditExpenseModal
          id={id}
          categories={categories}
          categoryId={categoryId}
          description={description}
          amountCents={amountCents}
          notes={notes}
          open={editingExpense}
          onClose={() => setEditingExpense(false)}
        />
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
            vence {dueDate}
            {status !== "Pago" && status !== "Cancelado" && (
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
      <span className="font-mono text-sm font-semibold">{formatCents(amountCents)}</span>
      <Badge tone={isOverdue ? "clay" : STATUS_TONE[status]}>{isOverdue ? "Atrasado" : status}</Badge>
      {status !== "Pago" && status !== "Cancelado" && (
        <button
          type="button"
          onClick={markPaid}
          disabled={pending}
          className="text-[11px] font-semibold text-pitch-dark hover:underline disabled:opacity-50"
        >
          Marcar pago
        </button>
      )}
      {status === "Pago" && (
        <button
          type="button"
          onClick={undoPaid}
          disabled={pending}
          className="text-[11px] font-semibold text-ink-faint hover:text-clay disabled:opacity-50"
        >
          Desfazer baixa
        </button>
      )}
      {status === "Pendente" && (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-[11px] font-semibold text-ink-faint hover:text-clay disabled:opacity-50"
        >
          Cancelar
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-ink-faint hover:text-clay text-[11px] leading-none"
        aria-label="Excluir despesa"
      >
        ✕
      </button>
    </div>
  );
}
