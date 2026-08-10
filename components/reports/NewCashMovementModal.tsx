"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createCashMovement } from "@/lib/actions/cashClosure";

export function NewCashMovementModal({ movementDate }: { movementDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createCashMovement(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Lançamento avulso
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Lançamento avulso de caixa">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="movementDate" value={movementDate} />
          <p className="text-[12.5px] text-ink-soft m-0">
            Para recebimentos que não vêm de um atleta (ex.: venda de uniforme avulsa) ou
            retiradas do caixa (ex.: troco, sangria).
          </p>
          <Field label="Tipo">
            <select
              name="type"
              defaultValue="entrada"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="entrada">Entrada (recebimento avulso)</option>
              <option value="saida">Saída (retirada do caixa)</option>
            </select>
          </Field>
          <Field label="Descrição">
            <Input name="description" required placeholder="Ex: Venda de uniforme avulso" />
          </Field>
          <Field label="Valor (R$)">
            <Input name="amount" required inputMode="decimal" placeholder="Ex: 50,00" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Lançando…" : "Lançar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
