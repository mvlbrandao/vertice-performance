"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createMeeting } from "@/lib/actions/agenda";
import { useFormModal } from "@/lib/utils/useFormModal";

/**
 * Versão enxuta do NewMeetingModal pro staff: só atleta concedido com
 * nível "manage" (sem alvo por time inteiro, sem jogada da Mesa Tática —
 * nenhum dos dois é algo que staff gerencia).
 */
export function NewStaffMeetingModal({
  athletes,
}: {
  athletes: { id: string; full_name: string }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createMeeting);

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)} disabled={athletes.length === 0}>
        + Agendar encontro
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Agendar encontro">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="targetType" value="athlete" />
          <Field label="Atleta">
            <select
              name="athleteId"
              required
              defaultValue={athletes[0]?.id ?? ""}
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
            <Input name="title" required placeholder="Ex: Sessão de fisioterapia" />
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
              defaultValue="Presencial"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="Presencial">Presencial</option>
              <option value="Videochamada">Videochamada</option>
            </select>
          </Field>
          <input type="hidden" name="purpose" value="Específico" />
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
