"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { processDataRequest } from "@/lib/actions/dataRequests";

export function ResolveDataRequestButton({
  requestId,
  requestType,
}: {
  requestId: string;
  requestType: "export" | "deletion";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    setPending(true);
    setError(null);
    const result = await processDataRequest(requestId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (requestType === "export") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" onClick={handleProcess} disabled={pending}>
          {pending ? "Gerando…" : "📄 Gerar exportação"}
        </Button>
        {error && <span className="text-clay text-[11px]">{error}</span>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        🗑️ Confirmar exclusão
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[240px]">
      <p className="text-[11.5px] text-ink-soft m-0 text-right">
        Isso anonimiza os dados pessoais do atleta, apaga treinos/mídia e cancela cobrança ativa
        no Asaas. Não tem volta.
      </p>
      <div className="flex gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="danger" size="sm" onClick={handleProcess} disabled={pending}>
          {pending ? "Processando…" : "Tenho certeza"}
        </Button>
      </div>
      {error && <span className="text-clay text-[11px]">{error}</span>}
    </div>
  );
}
