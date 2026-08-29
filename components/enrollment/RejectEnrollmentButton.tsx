"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { rejectEnrollment } from "@/lib/actions/enrollment";

export function RejectEnrollmentButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    await rejectEnrollment(requestId, notes);
    setPending(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        ❌ Rejeitar
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Motivo (opcional)"
        className="w-full px-2.5 py-2 border border-line rounded-sm resize-y text-[12.5px]"
      />
      <div className="flex gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="danger" size="sm" onClick={handleConfirm} disabled={pending}>
          {pending ? "…" : "Confirmar rejeição"}
        </Button>
      </div>
    </div>
  );
}
