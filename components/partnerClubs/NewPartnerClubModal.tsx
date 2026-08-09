"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createPartnerClub } from "@/lib/actions/partnerClubs";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewPartnerClubModal() {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createPartnerClub);

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Novo clube
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo clube">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome do clube">
            <Input name="name" required placeholder="Ex: Sociedade Esportiva Palmeiras" autoFocus />
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
