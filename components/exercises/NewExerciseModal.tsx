"use client";

import { useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createExercise } from "@/lib/actions/exercises";
import { useFormModal } from "@/lib/utils/useFormModal";
import { getFocusTagSuggestions } from "@/lib/data/swotCatalog";
import { getExerciseSuggestions } from "@/lib/data/exerciseCatalog";
import { hojeISO } from "@/lib/utils/date";

export function NewExerciseModal({
  athleteId,
  openSwotItems = [],
  positions = [],
}: {
  athleteId: string;
  openSwotItems?: { id: string; category: string; description: string }[];
  positions?: string[] | null;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createExercise);
  const focusSuggestions = getFocusTagSuggestions(positions ?? []);
  const exerciseSuggestions = getExerciseSuggestions(positions ?? []);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const focusRef = useRef<HTMLInputElement>(null);

  function handleExerciseNameInput(name: string) {
    const match = exerciseSuggestions.find((e) => e.name === name);
    if (!match) return;
    if (descriptionRef.current && !descriptionRef.current.value) {
      descriptionRef.current.value = match.description;
    }
    if (focusRef.current && !focusRef.current.value) {
      focusRef.current.value = match.focus;
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Prescrever
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Prescrever exercício">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Nome do exercício">
            <Input
              name="name"
              required
              list="exercise-suggestions"
              placeholder="Ex: Equilíbrio unipodal com bola"
              onInput={(e) => handleExerciseNameInput(e.currentTarget.value)}
            />
            <datalist id="exercise-suggestions">
              {exerciseSuggestions.map((e) => (
                <option key={e.name} value={e.name} />
              ))}
            </datalist>
          </Field>
          {openSwotItems.length > 0 && (
            <Field label="Vincular a um ponto da anamnese (opcional)">
              <select
                name="swotItemId"
                defaultValue=""
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                <option value="">Nenhum</option>
                {openSwotItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.category} — {it.description}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Descrição / séries">
            <textarea
              ref={descriptionRef}
              name="description"
              rows={2}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
            />
          </Field>
          <Field label="Foco (deficiência trabalhada)">
            <Input
              ref={focusRef}
              name="focus"
              list="focus-suggestions"
              placeholder="Ex: Equilíbrio no jogo de campo"
            />
            <datalist id="focus-suggestions">
              {focusSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Data">
            <Input
              name="scheduledDate"
              type="date"
              defaultValue={hojeISO()}
            />
          </Field>
          <Field label="Link do vídeo (opcional)">
            <Input name="videoUrl" placeholder="Cole o link do vídeo (YouTube, Drive...)" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Enviar rotina"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
