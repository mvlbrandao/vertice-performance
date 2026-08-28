import { supportWhatsAppUrl, supportMailtoUrl, SUPPORT_EMAIL } from "@/lib/config/support";

/** Link direto pro suporte, pra quando não dá pra esperar quem administra o clube resolver. */
export function SupportContactLinks({ clubName }: { clubName: string }) {
  const assunto = `Acesso suspenso — ${clubName}`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
      <a
        href={supportWhatsAppUrl(`Olá! O acesso do clube "${clubName}" está suspenso e eu gostaria de ajuda.`)}
        target="_blank"
        rel="noreferrer"
        className="underline text-ink-soft hover:text-ink"
      >
        Falar no WhatsApp
      </a>
      <a href={supportMailtoUrl(assunto)} className="underline text-ink-soft hover:text-ink">
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
