"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deletePlay } from "@/lib/actions/plays";

export function DeletePlayButton({ playId }: { playId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setPending(true);
    await deletePlay(playId);
    setPending(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-ink-faint">Excluir?</span>
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
          {pending ? "…" : "Sim"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
      🗑 Excluir
    </Button>
  );
}
