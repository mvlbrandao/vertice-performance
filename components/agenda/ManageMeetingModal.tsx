"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { saveMeetingNotes, cancelMeeting } from "@/lib/actions/agenda";

export function ManageMeetingModal({
  meetingId,
  title,
  athleteName,
  date,
  time,
  type,
  initialNotes,
}: {
  meetingId: string;
  title: string;
  athleteName: string;
  date: string;
  time: string;
  type: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveNotes() {
    setPending(true);
    setError(null);
    const result = await saveMeetingNotes(meetingId, notes);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleCancel() {
    setPending(true);
    setError(null);
    const result = await cancelMeeting(meetingId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Gerenciar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Gerenciar encontro">
        <div className="flex gap-2 items-start bg-chalk border border-line rounded-md px-3.5 py-3 text-[12.5px] mb-4">
          <span>{type === "Videochamada" ? "🎥" : "📍"}</span>
          <span>
            <b>{title}</b>
            <br />
            {athleteName} · {date} às {time} · {type}
          </span>
        </div>
        <Field label="Notas do encontro">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2.5 border border-line rounded-sm resize-y text-sm"
            placeholder="O que foi conversado, combinado ou observado..."
          />
        </Field>
        {error && <div className="text-clay text-[12.5px] font-medium mt-2">{error}</div>}
        <div className="flex justify-between gap-2.5 mt-4">
          <Button variant="danger" onClick={handleCancel} disabled={pending}>
            Cancelar encontro
          </Button>
          <Button variant="solid" onClick={handleSaveNotes} disabled={pending}>
            {pending ? "Salvando…" : "Salvar notas"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
