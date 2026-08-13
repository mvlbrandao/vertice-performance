"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createMentalNote } from "@/lib/actions/timeline";
import { useFormModal } from "@/lib/utils/useFormModal";
import { hojeISO } from "@/lib/utils/date";

export function NewMentalNoteModal({
  athleteId,
  openSwotItems = [],
}: {
  athleteId: string;
  openSwotItems?: { id: string; category: string; description: string }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createMentalNote);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        🧠 Registro mental
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Registro de análise mental">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Field label="Título">
            <Input name="title" required placeholder="Ex: Confiança em duelos 1x1" />
          </Field>
          <Field label="Data">
            <Input
              name="entryDate"
              type="date"
              defaultValue={hojeISO()}
            />
          </Field>
          <Field label="Observações">
            <textarea
              name="body"
              rows={3}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
              placeholder="Confiança, inteligência emocional, postura em jogo..."
            />
          </Field>
          <Field label="Nível de confiança (0–10)">
            <Input name="score" type="number" min={0} max={10} defaultValue={7} />
          </Field>
          <Field label="Vídeo de apoio (opcional)">
            <Input name="videoUrl" placeholder="Cole o link do vídeo (YouTube, Drive...)" />
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
