"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateClub } from "@/lib/actions/clubs";
import { useFormModal } from "@/lib/utils/useFormModal";

export function EditClubNameModal({ currentName }: { currentName: string }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(updateClub);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ✏️ Editar nome
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar nome do clube">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome do clube">
            <Input name="name" required defaultValue={currentName} autoFocus />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
