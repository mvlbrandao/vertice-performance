"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { reviewCancellationRequest } from "@/lib/actions/cancellation";

export function PendingCancellationCard({
  requestId,
  reasonCategory,
  reasonDetail,
  requestedAt,
}: {
  requestId: string;
  reasonCategory: string;
  reasonDetail: string | null;
  requestedAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"Aprovado" | "Rejeitado" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApproveForm, setShowApproveForm] = useState(false);

  async function handleReject() {
    setPending("Rejeitado");
    setError(null);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("decision", "Rejeitado");
    const result = await reviewCancellationRequest(fd);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleApprove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending("Aprovado");
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("requestId", requestId);
    formData.set("decision", "Aprovado");
    const result = await reviewCancellationRequest(formData);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mb-4 border-amber bg-[#FFF9E6]">
      <b className="text-sm block mb-1">🔔 Solicitação de cancelamento pendente</b>
      <p className="text-[12.5px] text-ink-soft m-0 mb-2">
        Motivo: <b>{reasonCategory}</b>
        {reasonDetail ? ` — ${reasonDetail}` : ""} · solicitado em{" "}
        {new Date(requestedAt).toLocaleDateString("pt-BR")}
      </p>

      {!showApproveForm ? (
        <div className="flex gap-2">
          <Button
            variant="solid"
            size="sm"
            onClick={() => setShowApproveForm(true)}
            disabled={pending !== null}
          >
            Aprovar cancelamento
          </Button>
          <Button variant="outline" size="sm" onClick={handleReject} disabled={pending !== null}>
            {pending === "Rejeitado" ? "Rejeitando…" : "Rejeitar"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleApprove} className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft cursor-pointer">
            <input type="checkbox" name="cancelFutureCharges" />
            Cancelar também as parcelas futuras em aberto
          </label>
          <Field label="Observações (opcional)">
            <Input name="reviewNotes" placeholder="Ex: confirmado com o responsável por telefone" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="solid" size="sm" disabled={pending !== null}>
              {pending === "Aprovado" ? "Confirmando…" : "Confirmar aprovação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowApproveForm(false)}
              disabled={pending !== null}
            >
              Voltar
            </Button>
          </div>
        </form>
      )}
      {error && <div className="text-clay text-[12.5px] font-medium mt-2">{error}</div>}
    </Card>
  );
}
