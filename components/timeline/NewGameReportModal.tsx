"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createGameReport } from "@/lib/actions/timeline";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewGameReportModal({ athleteId }: { athleteId: string }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createGameReport);

  return (
    <>
      <Button variant="amber" onClick={() => setOpen(true)}>
        + Relatório de jogo
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo relatório de jogo">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Jogo / adversário">
            <Input name="opponent" required placeholder="Ex: Sub-12 x Guarabira FC" />
          </Field>
          <Field label="Pontos fortes">
            <textarea
              name="strengths"
              rows={2}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
              placeholder="O que se destacou no jogo"
            />
          </Field>
          <Field label="A melhorar">
            <textarea
              name="improve"
              rows={2}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
              placeholder="Pontos de atenção para os próximos treinos"
            />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="amber" disabled={pending}>
              {pending ? "Salvando…" : "Salvar relatório"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
