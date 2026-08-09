"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createRecurringBilling } from "@/lib/actions/asaasBilling";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewRecurringBillingModal({ athleteId }: { athleteId: string }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createRecurringBilling);

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Cobrança recorrente
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova cobrança recorrente">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Descrição">
            <Input name="description" required placeholder="Ex: Mensalidade" />
          </Field>
          <Field label="Valor (R$)">
            <Input name="amount" required inputMode="decimal" placeholder="Ex: 150,00" />
          </Field>
          <Field label="Forma de pagamento">
            <select
              name="billingType"
              defaultValue="UNDEFINED"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="UNDEFINED">Atleta escolhe no checkout</option>
              <option value="CREDIT_CARD">Cartão de crédito</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </Field>
          <Field label="Primeiro vencimento">
            <Input name="nextDueDate" type="date" required />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Criando…" : "Criar assinatura"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
