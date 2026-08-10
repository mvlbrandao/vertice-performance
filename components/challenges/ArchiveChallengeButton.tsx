"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveChallenge } from "@/lib/actions/challenges";

export function ArchiveChallengeButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    setPending(true);
    await archiveChallenge(challengeId);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleArchive}
      disabled={pending}
      className="text-ink-faint hover:text-clay text-[11px] leading-none shrink-0"
      aria-label="Arquivar desafio"
    >
      ✕
    </button>
  );
}
