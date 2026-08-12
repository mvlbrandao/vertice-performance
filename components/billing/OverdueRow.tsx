"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { OverdueAthlete } from "@/lib/billing/overdue";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Só dígitos + DDI do Brasil, que é o formato que o wa.me exige. */
function whatsappHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function buildMessage(athlete: OverdueAthlete, clubName: string) {
  const nome = athlete.guardianName?.split(" ")[0] ?? "Olá";
  const plural = athlete.charges.length > 1;
  const lista = athlete.charges
    .map((c) => `• ${c.description} — ${formatCents(c.amountCents)} (venceu em ${c.dueDate})`)
    .join("\n");
  return (
    `Oi, ${nome}! Tudo bem?\n\n` +
    `Passando pra lembrar d${plural ? "as mensalidades" : "a mensalidade"} de ${athlete.fullName} ` +
    `${plural ? "que estão" : "que está"} em aberto:\n\n${lista}\n\n` +
    `Total: ${formatCents(athlete.totalCents)}\n\n` +
    `Qualquer dúvida é só chamar por aqui. Obrigado!\n${clubName}`
  );
}

export function OverdueRow({
  athlete,
  clubName,
}: {
  athlete: OverdueAthlete;
  clubName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = buildMessage(athlete, clubName);

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-line rounded-md px-3.5 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href={`/athletes/${athlete.athleteId}/financeiro`}
              className="font-bold text-[14px] hover:underline"
            >
              {athlete.fullName}
            </Link>
            <Badge tone={athlete.maxDaysLate > 30 ? "dark" : athlete.maxDaysLate > 15 ? "clay" : "amber"}>
              {athlete.maxDaysLate} {athlete.maxDaysLate === 1 ? "dia" : "dias"}
            </Badge>
          </div>
          <span className="text-[12px] text-ink-faint">
            {athlete.guardianName ?? "Sem responsável cadastrado"}
            {athlete.charges.length > 1 ? ` · ${athlete.charges.length} parcelas` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <b className="font-mono text-[15px]">{formatCents(athlete.totalCents)}</b>
          {athlete.guardianPhone ? (
            <a
              href={whatsappHref(athlete.guardianPhone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold px-3 py-2 text-[12.5px] bg-[#25D366] text-white border-[#25D366] hover:brightness-95 min-h-[38px]"
            >
              💬 Cobrar no WhatsApp
            </a>
          ) : (
            <Button variant="outline" size="sm" onClick={copyMessage}>
              {copied ? "✓ Copiado" : "Copiar cobrança"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Fechar" : "Detalhes"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex flex-col gap-1.5 mb-3">
            {athlete.charges.map((c) => (
              <div key={c.id} className="flex justify-between gap-3 text-[12.5px] flex-wrap">
                <span className="text-ink-soft">
                  {c.description}{" "}
                  <span className="text-ink-faint">
                    · venceu {c.dueDate} ({c.daysLate}d)
                  </span>
                </span>
                <span className="font-mono">{formatCents(c.amountCents)}</span>
              </div>
            ))}
          </div>
          <div className="bg-chalk border border-line rounded-sm px-3 py-2.5">
            <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide block mb-1">
              Mensagem que será enviada
            </span>
            <p className="text-[12px] text-ink-soft whitespace-pre-line m-0">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
