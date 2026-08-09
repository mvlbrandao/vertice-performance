"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createCharge } from "@/lib/actions/billing";
import { useFormModal } from "@/lib/utils/useFormModal";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function NewChargeModal({ athleteId }: { athleteId: string }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createCharge);
  const now = new Date();

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Novo lançamento
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo lançamento">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Descrição">
            <Input name="description" required placeholder="Ex: Mensalidade" />
          </Field>
          <Field label="Valor (R$)">
            <Input name="amount" required inputMode="decimal" placeholder="Ex: 150,00" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Mês de referência">
              <select
                name="competenceMonth"
                defaultValue={String(now.getMonth() + 1)}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ano">
              <Input name="competenceYear" type="number" defaultValue={now.getFullYear()} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Vencimento (1ª parcela)">
              <Input name="dueDate" type="date" required />
            </Field>
            <Field label="Parcelas">
              <select
                name="installments"
                defaultValue="1"
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 10, 12, 18, 24].map((n) => (
                  <option key={n} value={n}>
                    {n}x{n > 1 ? " (mensal)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[11.5px] text-ink-faint -mt-1.5">
            Gera um lançamento por mês, mesmo valor, vencendo a cada 30 dias a partir da data
            acima.
          </p>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Lançar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
