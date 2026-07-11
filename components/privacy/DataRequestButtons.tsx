"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { submitDataRequest } from "@/lib/actions/dataRequests";

export function DataRequestButtons() {
  const router = useRouter();
  const [pending, setPending] = useState<"export" | "deletion" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRequest(type: "export" | "deletion") {
    setPending(type);
    setMessage(null);
    const result = await submitDataRequest(type);
    setPending(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      type === "export"
        ? "Solicitação enviada! Você receberá uma cópia dos seus dados por e-mail em até 15 dias, conforme a LGPD."
        : "Solicitação de exclusão enviada ao seu treinador e responsável legal para confirmação.",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="outline"
        size="sm"
        disabled={pending !== null}
        onClick={() => handleRequest("export")}
      >
        📄 {pending === "export" ? "Enviando…" : "Baixar meus dados"}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending !== null}
        onClick={() => handleRequest("deletion")}
      >
        🗑️ {pending === "deletion" ? "Enviando…" : "Solicitar exclusão dos meus dados"}
      </Button>
      {message && <p className="text-[12.5px] text-ink-soft m-0">{message}</p>}
    </div>
  );
}
