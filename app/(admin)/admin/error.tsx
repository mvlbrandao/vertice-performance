"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Falha ao montar uma tela de administração. Mostra o código (digest) em vez
 * da mensagem: em produção o Next esconde a mensagem real do cliente, e o
 * digest é o que casa com a linha no log do servidor.
 */
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="max-w-xl">
      <h1 className="text-[22px] mt-0 mb-1">Não foi possível carregar esta tela</h1>
      <p className="text-[13px] text-ink-soft mt-0 mb-3">
        Algo falhou ao ler os dados da plataforma. Tente de novo; se persistir, procure o código
        abaixo no log do servidor.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-ink-faint mt-0 mb-3 break-all">código: {error.digest}</p>
      )}
      <Button variant="solid" size="sm" onClick={() => unstable_retry()}>
        Tentar de novo
      </Button>
    </Card>
  );
}
