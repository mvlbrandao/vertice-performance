"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requestCancellation } from "@/lib/actions/cancellation";
import { CANCELLATION_REASONS } from "@/lib/data/cancellationReasons";

export function RequestCancellationButton({
  pendingRequest,
}: {
  pendingRequest: { reasonCategory: string; requestedAt: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await requestCancellation(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (pendingRequest) {
    return (
      <div className="bg-[#FFF9E6] border border-amber rounded-md px-3.5 py-3 text-[12.5px] text-ink-soft">
        🔔 Cancelamento solicitado ({pendingRequest.reasonCategory}) em{" "}
        {new Date(pendingRequest.requestedAt).toLocaleDateString("pt-BR")} — aguardando
        confirmação do treinador.
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Solicitar cancelamento de contrato
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Solicitar cancelamento">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-soft m-0">
            Sua solicitação será enviada ao treinador, que precisa confirmar antes que o contrato
            seja efetivamente cancelado.
          </p>
          <Field label="Motivo">
            <select
              name="reasonCategory"
              required
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detalhes (opcional)">
            <Input name="reasonDetail" placeholder="Conte um pouco mais, se quiser" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
