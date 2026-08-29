"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getDataExportDownloadUrl } from "@/lib/actions/dataRequests";

export function DownloadExportButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await getDataExportDownloadUrl(requestId);
    setPending(false);
    if (result.error || !result.url) {
      setError(result.error ?? "Não foi possível gerar o link.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "…" : "⬇️ Baixar"}
      </Button>
      {error && <span className="text-clay text-[11px]">{error}</span>}
    </div>
  );
}
