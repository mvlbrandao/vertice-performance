"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { closeSwotCycle } from "@/lib/actions/swot";

export function CloseCycleButton({ cycleId, athleteId }: { cycleId: string; athleteId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    await closeSwotCycle(cycleId, athleteId);
    setPending(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-ink-faint">Fechar este ciclo?</span>
        <Button variant="danger" size="sm" onClick={handleConfirm} disabled={pending}>
          {pending ? "…" : "Sim, fechar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
      Fechar ciclo e reavaliar
    </Button>
  );
}
