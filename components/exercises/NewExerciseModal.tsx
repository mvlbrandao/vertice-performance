"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createExercise } from "@/lib/actions/exercises";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewExerciseModal({ athleteId }: { athleteId: string }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createExercise);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Prescrever
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Prescrever exercício">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Nome do exercício">
            <Input name="name" required placeholder="Ex: Equilíbrio unipodal com bola" />
          </Field>
          <Field label="Descrição / séries">
            <textarea
              name="description"
              rows={2}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
            />
          </Field>
          <Field label="Foco (deficiência trabalhada)">
            <Input name="focus" placeholder="Ex: Equilíbrio no jogo de campo" />
          </Field>
          <Field label="Data">
            <Input
              name="scheduledDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Link do vídeo (opcional)">
            <Input name="videoUrl" placeholder="Cole o link do vídeo (YouTube, Drive...)" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Enviar rotina"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
