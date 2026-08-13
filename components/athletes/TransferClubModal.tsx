"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { transferAthleteClub } from "@/lib/actions/transfers";
import { useFormModal } from "@/lib/utils/useFormModal";
import type { PartnerClubOption } from "@/lib/types/partnerClubs";
import { hojeISO } from "@/lib/utils/date";

export function TransferClubModal({
  athleteId,
  currentTeam,
  partnerClubs,
}: {
  athleteId: string;
  currentTeam: string | null;
  partnerClubs: PartnerClubOption[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal((formData) =>
    transferAthleteClub(athleteId, formData),
  );
  const [toClub, setToClub] = useState("");
  const toClubOption = partnerClubs.find((c) => c.id === toClub);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        🔁 Transferir de clube
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Transferir atleta de clube">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft m-0">
            Clube atual: <b>{currentTeam ?? "—"}</b>. A transferência fica registrada no histórico
            e na linha do tempo do atleta.
          </p>
          <Field label="Novo clube">
            <select
              name="toPartnerClubId"
              required
              value={toClub}
              onChange={(e) => setToClub(e.target.value)}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Selecione…</option>
              {partnerClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Novo sub / categoria">
            {toClubOption && toClubOption.categories.length > 0 ? (
              <select
                key={toClub}
                name="toCategory"
                defaultValue=""
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                <option value="">Selecione…</option>
                {toClubOption.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <Input name="toCategory" placeholder="Ex: Sub-12" disabled={!toClub} />
            )}
          </Field>
          <Field label="Data da transferência">
            <Input
              name="transferredAt"
              type="date"
              required
              defaultValue={hojeISO()}
            />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Confirmar transferência"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
