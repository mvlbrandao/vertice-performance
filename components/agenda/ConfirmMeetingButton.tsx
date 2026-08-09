"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { confirmMeetingAttendance } from "@/lib/actions/agenda";

export function ConfirmMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await confirmMeetingAttendance(meetingId);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="amber" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "…" : "✅ Confirmar presença"}
    </Button>
  );
}
