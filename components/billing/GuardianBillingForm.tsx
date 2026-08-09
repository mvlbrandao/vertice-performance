"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateGuardianBillingInfo } from "@/lib/actions/asaasBilling";

export function GuardianBillingForm({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateGuardianBillingInfo(new FormData(e.currentTarget));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <input type="hidden" name="athleteId" value={athleteId} />
      <p className="text-[12.5px] text-ink-soft m-0">
        Pra criar cobrança recorrente, cadastre o CPF e e-mail do responsável financeiro
        (necessário pro Asaas identificar quem paga).
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <Field label="CPF do responsável">
          <Input name="cpf" required placeholder="000.000.000-00" />
        </Field>
        <Field label="E-mail do responsável">
          <Input name="email" type="email" required placeholder="responsavel@email.com" />
        </Field>
      </div>
      {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
      <div className="flex justify-end">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
