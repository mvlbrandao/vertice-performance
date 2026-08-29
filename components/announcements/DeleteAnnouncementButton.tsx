"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteAnnouncement } from "@/lib/actions/announcements";

export function DeleteAnnouncementButton({ announcementId }: { announcementId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await deleteAnnouncement(announcementId);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "…" : "🗑️ Remover"}
    </Button>
  );
}
