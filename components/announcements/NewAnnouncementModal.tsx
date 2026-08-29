"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createAnnouncement } from "@/lib/actions/announcements";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewAnnouncementModal({
  teams,
  categories,
}: {
  teams: string[];
  categories: string[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } =
    useFormModal(createAnnouncement);

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)}>
        + Novo aviso
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo aviso">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Título">
            <Input name="title" required placeholder="Ex: Treino remarcado essa semana" />
          </Field>
          <Field label="Mensagem">
            <textarea
              name="body"
              required
              rows={4}
              className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
            />
          </Field>
          <Field label="Time (opcional)">
            <select
              name="targetTeam"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Todos os times</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoria (opcional)">
            <select
              name="targetCategory"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <span className="text-[11px] text-ink-faint -mt-1.5">
            Sem time ou categoria selecionados, o aviso alcança todo o clube.
          </span>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Publicando…" : "Publicar aviso"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
