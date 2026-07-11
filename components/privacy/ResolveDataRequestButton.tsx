"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveDataRequest } from "@/lib/actions/dataRequests";

export function ResolveDataRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await resolveDataRequest(requestId);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "…" : "Marcar como concluído"}
    </Button>
  );
}
