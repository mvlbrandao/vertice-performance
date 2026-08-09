"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createTeam } from "@/lib/actions/teams";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewTeamModal() {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createTeam);

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Novo time
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo time">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome do time">
            <Input name="name" required placeholder="Ex: Sub-12 A" autoFocus />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
