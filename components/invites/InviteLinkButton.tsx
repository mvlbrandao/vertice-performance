"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createInviteLink } from "@/lib/actions/inviteLinks";

/**
 * Gera um link de convite pro treinador mandar por WhatsApp. Substitui a
 * dependência do e-mail do Supabase, que trava por limite de envio.
 */
export function InviteLinkButton({
  role,
  athleteId,
  fullName,
  title,
  label = "🔗 Link de convite",
  disabled,
}: {
  role: "athlete" | "staff";
  athleteId?: string;
  fullName: string;
  title?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setPending(true);
    setError(null);
    const result = await createInviteLink({ role, athleteId, fullName, title });
    setPending(false);
    if (result.error || !result.token) {
      setError(result.error ?? "Não foi possível gerar o link.");
      return;
    }
    setUrl(`${window.location.origin}/convite/${result.token}`);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openModal() {
    setOpen(true);
    setUrl(null);
    setError(null);
    generate();
  }

  const message = url
    ? `Oi! Criei seu acesso ao app do clube. É só abrir este link e escolher sua senha:\n\n${url}\n\nO link vale por 7 dias.`
    : "";

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal} disabled={disabled}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Link de convite">
        {pending && <p className="text-[13px] text-ink-soft m-0">Gerando link…</p>}
        {error && <p className="text-clay text-[13px] font-medium m-0">{error}</p>}
        {url && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-soft m-0">
              Mande este link para <b>{fullName}</b>. Ele vale por <b>7 dias</b> e só pode ser
              usado uma vez.
            </p>
            <div className="bg-chalk border border-line rounded-sm px-3 py-2.5 break-all font-mono text-[12px]">
              {url}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="solid" size="sm" onClick={copy}>
                {copied ? "✓ Copiado" : "Copiar link"}
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-sm border font-semibold px-3 py-2 text-[12.5px] bg-[#25D366] text-white border-[#25D366] hover:brightness-95"
              >
                💬 Enviar no WhatsApp
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
