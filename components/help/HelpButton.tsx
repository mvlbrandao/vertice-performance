"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PAGE_HELP } from "@/lib/data/pageHelp";

/**
 * Botão de ajuda flutuante. Aparece só nas telas que têm texto escrito
 * para elas — ajuda genérica não ajuda ninguém, e um "?" que abre "sem
 * conteúdo" gasta a confiança da pessoa na próxima vez.
 */
export function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const help = PAGE_HELP[pathname];

  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ajuda sobre ${help.titulo}`}
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-pitch-dark text-chalk border-2 border-amber shadow-lg font-display text-lg print:hidden hover:brightness-125"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-paper w-full sm:max-w-[420px] rounded-t-xl sm:rounded-xl p-5 sm:p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h2 className="text-[19px] m-0 font-display">{help.titulo}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-faint text-lg leading-none shrink-0"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <p className="text-[13.5px] text-ink-soft mt-0 mb-3.5">{help.resumo}</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
              {help.acoes.map((acao) => (
                <li key={acao} className="flex gap-2 text-[13px] leading-relaxed">
                  <span className="text-amber shrink-0">▸</span>
                  <span>{acao}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
