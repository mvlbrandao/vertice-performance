"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { provisionAthleteAccount } from "@/lib/actions/provisionAthleteAccount";

export function InviteAthleteModal({
  athleteId,
  fullName,
  alreadyProvisioned,
}: {
  athleteId: string;
  fullName: string;
  alreadyProvisioned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const email = new FormData(e.currentTarget).get("email") as string;
    const result = await provisionAthleteAccount({ athleteId, email, fullName });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (alreadyProvisioned) {
    return <span className="text-xs text-ink-faint">✅ Conta de acesso já criada</span>;
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        📧 Convidar atleta
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Convidar atleta para a plataforma">
        {success ? (
          <div className="text-sm text-ink-soft">
            Convite enviado! O atleta receberá um e-mail para definir a senha e acessar a
            plataforma.
            <div className="flex justify-end mt-4">
              <Button variant="solid" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-soft m-0">
              Cria um login para <b>{fullName}</b> acessar seu próprio perfil, treinos e
              check-ins.
            </p>
            <Field label="E-mail do atleta">
              <Input name="email" type="email" required placeholder="atleta@exemplo.com" />
            </Field>
            {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
            <div className="flex justify-end gap-2.5 mt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="solid" disabled={pending}>
                {pending ? "Enviando…" : "Enviar convite"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
