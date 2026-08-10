"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { submitChallenge } from "@/lib/actions/challenges";
import { useFormModal } from "@/lib/utils/useFormModal";

export function SubmitChallengeModal({
  challengeId,
  challengeTitle,
}: {
  challengeId: string;
  challengeTitle: string;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(submitChallenge);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    await handleSubmit(e);
    router.refresh();
  }

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        Enviar resposta
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={challengeTitle}>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="challengeId" value={challengeId} />
          <p className="text-[12.5px] text-ink-soft m-0">
            Poste o vídeo no seu Instagram e cole o link do post aqui embaixo.
          </p>
          <Field label="Link do post no Instagram">
            <Input name="instagramUrl" type="url" required placeholder="https://instagram.com/p/..." />
          </Field>
          <Field label="Observações (opcional)">
            <Input name="notes" placeholder="Algo que queira contar sobre o desafio" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
