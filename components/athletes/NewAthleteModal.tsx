"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createAthlete } from "@/lib/actions/athletes";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewAthleteModal() {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createAthlete);

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)}>
        + Novo atleta
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo atleta">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome completo">
            <Input name="fullName" required placeholder="Nome do atleta" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Data de nascimento">
              <Input name="birthDate" type="date" />
            </Field>
            <Field label="Categoria">
              <Input name="category" placeholder="Ex: Futsal Sub-12" />
            </Field>
            <Field label="Posição">
              <Input name="position" placeholder="Ex: Pivô" />
            </Field>
            <Field label="Time">
              <Input name="team" placeholder="Ex: Sub-12 A" />
            </Field>
          </div>
          <Field label="Responsável legal">
            <Input name="guardianName" placeholder="Nome do responsável" />
          </Field>
          <Field label="Celular do responsável">
            <Input name="guardianPhone" type="tel" placeholder="(83) 99999-0000" />
          </Field>
          <Field label="Instagram do atleta">
            <Input name="instagram" placeholder="@usuario" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
