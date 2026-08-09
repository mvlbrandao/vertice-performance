"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { uploadMediaItem } from "@/lib/storage/upload";
import { createMediaItemRecord } from "@/lib/actions/media";

export function NewMediaModal({ clubId, athleteId }: { clubId: string; athleteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const label = String(form.get("label") ?? "").trim();
    const entryDate = String(form.get("entryDate") ?? "");
    const file = form.get("file") as File | null;

    if (!label) {
      setError("Informe uma descrição.");
      return;
    }
    if (!file || file.size === 0) {
      setError("Selecione um arquivo.");
      return;
    }

    setPending(true);
    setError(null);

    const { path, error: uploadError } = await uploadMediaItem(clubId, athleteId, file);
    if (uploadError || !path) {
      setPending(false);
      setError(uploadError ?? "Falha no upload.");
      return;
    }

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const result = await createMediaItemRecord({
      athleteId,
      label,
      mediaType,
      storagePath: path,
      entryDate: entryDate || undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        📎 Anexar mídia
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Anexar mídia à linha do tempo">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Descrição">
            <Input name="label" required placeholder="Ex: Lance da finalização aos 12min" />
          </Field>
          <Field label="Data">
            <Input
              name="entryDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Arquivo (foto ou vídeo)">
            <input
              name="file"
              type="file"
              accept="image/*,video/*"
              required
              className="text-sm"
            />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Enviando…" : "Anexar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
