"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createSwotItem } from "@/lib/actions/swot";
import { useFormModal } from "@/lib/utils/useFormModal";
import type { SwotCategory } from "@/lib/types/database";

export function NewSwotItemModal({
  cycleId,
  athleteId,
  category,
  showTargets,
}: {
  cycleId: string;
  athleteId: string;
  category: SwotCategory;
  showTargets: boolean;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createSwotItem);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + Novo ponto
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Novo ponto — ${category}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="cycleId" value={cycleId} />
          <input type="hidden" name="athleteId" value={athleteId} />
          <input type="hidden" name="category" value={category} />
          <Field label="Descrição">
            <Input
              name="description"
              required
              placeholder="Ex: Não usa a perna esquerda pra finalizar"
            />
          </Field>
          {showTargets && (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Meta de encontros">
                <Input name="targetMeetings" type="number" min={0} defaultValue={0} />
              </Field>
              <Field label="Meta de treinos">
                <Input name="targetTrainings" type="number" min={0} defaultValue={0} />
              </Field>
            </div>
          )}
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Adicionar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
