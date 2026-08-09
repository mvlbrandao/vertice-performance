"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateAthlete } from "@/lib/actions/athletes";
import { useFormModal } from "@/lib/utils/useFormModal";
import type { PartnerClubOption } from "@/lib/types/partnerClubs";

type AthleteEditableData = {
  fullName: string;
  birthDate: string | null;
  category: string | null;
  position: string | null;
  team: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  athletePhone: string | null;
  instagram: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export function EditAthleteModal({
  athleteId,
  athlete,
  partnerClubs,
}: {
  athleteId: string;
  athlete: AthleteEditableData;
  partnerClubs: PartnerClubOption[];
}) {
  const [selectedClub, setSelectedClub] = useState(athlete.team ?? "");
  const availableCategories = partnerClubs.find((c) => c.name === selectedClub)?.categories ?? [];
  // se o atleta já tinha uma categoria fora da lista do time atual (dado legado), mantém como opção
  const categoryOptions =
    athlete.category && !availableCategories.includes(athlete.category)
      ? [athlete.category, ...availableCategories]
      : availableCategories;

  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal((formData) =>
    updateAthlete(athleteId, formData),
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ✏️ Editar dados
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar dados do atleta">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome completo">
            <Input name="fullName" required defaultValue={athlete.fullName} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Data de nascimento">
              <Input name="birthDate" type="date" defaultValue={athlete.birthDate ?? ""} />
            </Field>
            <Field label="Posição">
              <Input name="position" defaultValue={athlete.position ?? ""} />
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
                  {(athlete.team && !partnerClubs.some((c) => c.name === athlete.team)
                    ? [{ id: "legacy", name: athlete.team, categories: [] }, ...partnerClubs]
                    : partnerClubs
                  ).map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input name="team" defaultValue={athlete.team ?? ""} />
              )}
            </Field>
            <Field label="Categoria">
              {partnerClubs.length > 0 ? (
                <select
                  key={selectedClub}
                  name="category"
                  defaultValue={athlete.category ?? ""}
                  disabled={!selectedClub || categoryOptions.length === 0}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm disabled:opacity-50"
                >
                  <option value="">
                    {selectedClub ? "Selecione…" : "Escolha o time primeiro"}
                  </option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <Input name="category" defaultValue={athlete.category ?? ""} />
              )}
            </Field>
            <Field label="Altura (cm)">
              <Input
                name="heightCm"
                type="number"
                step="0.1"
                min="0"
                defaultValue={athlete.heightCm ?? ""}
              />
            </Field>
            <Field label="Peso (kg)">
              <Input
                name="weightKg"
                type="number"
                step="0.1"
                min="0"
                defaultValue={athlete.weightKg ?? ""}
              />
            </Field>
          </div>
          <Field label="Celular do atleta">
            <Input name="athletePhone" type="tel" defaultValue={athlete.athletePhone ?? ""} />
          </Field>
          <Field label="Responsável legal">
            <Input name="guardianName" defaultValue={athlete.guardianName ?? ""} />
          </Field>
          <Field label="Celular do responsável">
            <Input name="guardianPhone" type="tel" defaultValue={athlete.guardianPhone ?? ""} />
          </Field>
          <Field label="Instagram do atleta">
            <Input name="instagram" defaultValue={athlete.instagram ?? ""} />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
