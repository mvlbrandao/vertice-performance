"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createSwotItem } from "@/lib/actions/swot";
import { useFormModal } from "@/lib/utils/useFormModal";
import { getSwotCatalogSuggestions } from "@/lib/data/swotCatalog";
import type { SwotCategory } from "@/lib/types/database";

const OTHER = "__outro__";

export function NewSwotItemModal({
  cycleId,
  athleteId,
  category,
  showTargets,
  positions = [],
}: {
  cycleId: string;
  athleteId: string;
  category: SwotCategory;
  showTargets: boolean;
  positions?: string[] | null;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createSwotItem);
  const suggestions = getSwotCatalogSuggestions(category, positions ?? []);
  const [choice, setChoice] = useState("");
  const [customText, setCustomText] = useState("");
  const isOther = choice === OTHER;
  const description = isOther ? customText : choice;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + Novo ponto
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Novo ponto — ${category}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="cycleId" value={cycleId} />
          <input type="hidden" name="athleteId" value={athleteId} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="description" value={description} />
          <Field label="Ponto (catálogo)">
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {suggestions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={OTHER}>Outro (descrever)</option>
            </select>
          </Field>
          {isOther && (
            <Field label="Descreva o ponto">
              <Input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                required
                placeholder="Ex: Não usa a perna esquerda pra finalizar"
              />
            </Field>
          )}
          {showTargets && (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Meta de encontros">
                <Input name="targetMeetings" type="number" min={0} defaultValue={0} />
              </Field>
              <Field label="Meta de treinos">
                <Input name="targetTrainings" type="number" min={0} defaultValue={0} />
              </Field>
            </div>
          )}
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending || !description.trim()}>
              {pending ? "Salvando…" : "Adicionar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
