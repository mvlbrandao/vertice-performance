"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createMeeting } from "@/lib/actions/agenda";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewMeetingModal({
  athletes,
}: {
  athletes: { id: string; full_name: string }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createMeeting);

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)}>
        + Agendar encontro
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Agendar encontro">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Atleta">
            <select
              name="athleteId"
              required
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título">
            <Input name="title" required placeholder="Ex: Feedback de jogo" />
          </Field>
          <Field label="Data">
            <Input name="date" type="date" required />
          </Field>
          <Field label="Horário">
            <Input name="time" type="time" defaultValue="19:30" required />
          </Field>
          <Field label="Formato">
            <select
              name="type"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="Presencial">Presencial</option>
              <option value="Videochamada">Videochamada</option>
            </select>
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Agendando…" : "Agendar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
