"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createAthlete } from "@/lib/actions/athletes";
import { useFormModal } from "@/lib/utils/useFormModal";
import type { PartnerClubOption } from "@/lib/types/partnerClubs";

export function NewAthleteModal({ partnerClubs }: { partnerClubs: PartnerClubOption[] }) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createAthlete);
  const [selectedClub, setSelectedClub] = useState("");
  const availableCategories = partnerClubs.find((c) => c.name === selectedClub)?.categories ?? [];

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
            <Field label="Posição">
              <Input name="position" placeholder="Ex: Pivô" />
            </Field>
            <Field label="Time">
              {partnerClubs.length > 0 ? (
                <select
                  name="team"
                  value={selectedClub}
                  onChange={(e) => setSelectedClub(e.target.value)}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
                >
                  <option value="">Selecione…</option>
                  {partnerClubs.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input name="team" placeholder="Ex: Sociedade Esportiva Palmeiras" />
              )}
            </Field>
            <Field label="Categoria">
              {partnerClubs.length > 0 ? (
                <select
                  key={selectedClub}
                  name="category"
                  defaultValue=""
                  disabled={!selectedClub || availableCategories.length === 0}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm disabled:opacity-50"
                >
                  <option value="">
                    {selectedClub ? "Selecione…" : "Escolha o time primeiro"}
                  </option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <Input name="category" placeholder="Ex: Futsal Sub-12" />
              )}
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
