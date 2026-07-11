"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { submitCheckin } from "@/lib/actions/checkins";
import { useFormModal } from "@/lib/utils/useFormModal";

export function CheckinForm() {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(submitCheckin);

  return (
    <>
      <Button variant="amber" onClick={() => setOpen(true)}>
        + Registrar check-in de hoje
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Check-in de hoje">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nível de cansaço (1–5)">
            <Input name="fatigue" type="number" min={1} max={5} defaultValue={2} required />
          </Field>
          <Field label="Dores relatadas">
            <Input name="pain" placeholder="Ex: Nenhuma" />
          </Field>
          <Field label="Treino concluído?">
            <select
              name="trainingDone"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </Field>
          <Field label="Dieta seguida?">
            <select
              name="dietDone"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="amber" disabled={pending}>
              {pending ? "Registrando…" : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
