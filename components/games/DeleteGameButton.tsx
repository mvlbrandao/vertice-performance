"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGame } from "@/lib/actions/games";

export function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    await deleteGame(gameId);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-ink-faint hover:text-clay text-[11px] leading-none disabled:opacity-50"
      aria-label="Remover jogo"
    >
      ✕
    </button>
  );
}
