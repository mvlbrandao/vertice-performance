"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { openSwotCycle } from "@/lib/actions/swot";

export function OpenCycleButton({ athleteId, label }: { athleteId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await openSwotCycle(athleteId);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="amber" onClick={handleClick} disabled={pending}>
      {pending ? "Iniciando…" : label}
    </Button>
  );
}
