"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { closeCashRegister, reopenCashRegister } from "@/lib/actions/cashClosure";
import { hojeISO } from "@/lib/utils/date";

export function CloseCashRegisterButton({ closureDate }: { closureDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  async function handleClose() {
    setPending(true);
    const fd = new FormData();
    fd.set("closureDate", closureDate);
    fd.set("notes", notes);
    await closeCashRegister(fd);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {showNotes && (
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações do fechamento (opcional)"
          className="w-[280px]"
        />
      )}
      <div className="flex gap-2">
        {!showNotes && (
          <Button variant="ghost" size="sm" onClick={() => setShowNotes(true)}>
            + observação
          </Button>
        )}
        <Button variant="solid" size="sm" onClick={handleClose} disabled={pending}>
          {pending ? "Fechando…" : "🔒 Fechar caixa"}
        </Button>
      </div>
    </div>
  );
}

function todayISO() {
  return hojeISO();
}

export function ReopenCashRegisterButton({ closureDate }: { closureDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const isPastDay = closureDate < todayISO();

  async function handleReopen() {
    if (isPastDay && !showReason) {
      setShowReason(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await reopenCashRegister(closureDate, reason);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {showReason && (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da reabertura (obrigatório)"
          className="w-[280px]"
        />
      )}
      {error && <div className="text-clay text-[11.5px] font-medium">{error}</div>}
      <Button variant="outline" size="sm" onClick={handleReopen} disabled={pending}>
        {pending ? "Reabrindo…" : isPastDay ? "🔓 Reabrir caixa (dia anterior)" : "🔓 Reabrir caixa"}
      </Button>
    </div>
  );
}
