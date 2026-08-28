"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { promisePayment } from "@/lib/actions/subscription";

/** Botão de autoatendimento: libera o clube por 48h sem precisar do suporte, uma vez só. */
export function PromisePaymentButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await promisePayment();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-[12.5px] text-ink-soft m-0 mb-2">
        Precisa de mais um tempo para regularizar? Você pode liberar o acesso do clube por 48h,
        uma única vez, prometendo pagar em seguida.
      </p>
      {error && <p className="text-clay text-[12.5px] font-medium m-0 mb-2">{error}</p>}
      <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "Liberando…" : "Prometo pagar — liberar por 48h"}
      </Button>
    </div>
  );
}
