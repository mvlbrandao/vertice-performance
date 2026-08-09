"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { inviteStaff } from "@/lib/actions/staff";
import { useFormModal } from "@/lib/utils/useFormModal";

export function InviteStaffModal() {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(inviteStaff);

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)}>
        + Convidar profissional
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Convidar profissional">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft m-0">
            Cria um login de staff sem acesso a nenhum atleta. Conceda o acesso atleta a atleta
            depois do convite.
          </p>
          <Field label="Nome completo">
            <Input name="fullName" required placeholder="Ex: Ana Souza" />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" required placeholder="profissional@exemplo.com" />
          </Field>
          <Field label="Função (opcional)">
            <Input name="title" placeholder="Ex: Preparador físico, Treinador de específicos" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Enviar convite"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
