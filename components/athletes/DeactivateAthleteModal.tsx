"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { setAthleteActive } from "@/lib/actions/athletes";

export function DeactivateAthleteModal({
  athleteId,
  isActive,
}: {
  athleteId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function handleDeactivate() {
    setPending(true);
    await setAthleteActive(athleteId, false, reason);
    setPending(false);
    setOpen(false);
    router.refresh();
  }

  async function handleReactivate() {
    setPending(true);
    await setAthleteActive(athleteId, true);
    setPending(false);
    router.refresh();
  }

  if (!isActive) {
    return (
      <Button variant="outline" size="sm" onClick={handleReactivate} disabled={pending}>
        {pending ? "Reativando…" : "🔄 Reativar atleta"}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        🚫 Desativar atleta
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Desativar atleta">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft m-0">
            O atleta sai da lista principal (fica marcado como inativo, histórico é preservado) e
            entra na contagem de churn do painel e dos relatórios financeiros.
          </p>
          <Field label="Motivo (opcional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: cancelamento de contrato, mudança de clube..."
            />
          </Field>
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="solid" onClick={handleDeactivate} disabled={pending}>
              {pending ? "Desativando…" : "Desativar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
