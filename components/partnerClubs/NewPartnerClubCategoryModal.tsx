"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createPartnerClubCategory } from "@/lib/actions/partnerClubs";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewPartnerClubCategoryModal({
  partnerClubId,
  clubName,
}: {
  partnerClubId: string;
  clubName: string;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(
    createPartnerClubCategory,
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Sub
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Novo sub em ${clubName}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="partnerClubId" value={partnerClubId} />
          <Field label="Nome do sub">
            <Input name="name" required placeholder="Ex: Sub-12" autoFocus />
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
