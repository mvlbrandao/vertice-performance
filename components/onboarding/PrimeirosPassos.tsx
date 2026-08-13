"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";

export interface Passo {
  chave: string;
  titulo: string;
  descricao: string;
  href: string;
  feito: boolean;
}

const DISMISS_KEY = "vertice-primeiros-passos-dispensado";

/**
 * Checklist de primeiros passos no painel.
 *
 * É o que mais move a agulha num teste de 15 dias: o cliente que cadastra
 * um atleta, cria uma cobrança e monta uma escalação entendeu o produto; o
 * que só olha o painel vazio some. Por isso vem antes de tour guiado na
 * ordem de prioridade.
 *
 * Some sozinho quando tudo estiver feito, e pode ser dispensado antes —
 * checklist que insiste depois de pronto vira ruído permanente.
 */
export function PrimeirosPassos({ passos }: { passos: Passo[] }) {
  const [dispensado, setDispensado] = useState(false);

  const concluidos = passos.filter((p) => p.feito).length;
  const total = passos.length;

  if (dispensado || concluidos === total) return null;

  return (
    <Card className="mb-4.5 border-amber/40">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-[17px] m-0">🚀 Primeiros passos</h2>
          <p className="text-[12.5px] text-ink-soft mt-0.5 mb-0">
            {concluidos} de {total} — leva uns 10 minutos e você já vê o sistema funcionando.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDispensado(true);
          }}
          className="text-[12px] text-ink-faint shrink-0 hover:text-ink"
        >
          Dispensar
        </button>
      </div>

      <div className="h-1.5 bg-line rounded-full overflow-hidden my-3">
        <div
          className="h-full bg-amber rounded-full transition-all"
          style={{ width: `${(concluidos / total) * 100}%` }}
        />
      </div>

      <div className="flex flex-col">
        {passos.map((passo) => (
          <div
            key={passo.chave}
            className="flex items-start gap-2.5 py-2.5 border-b border-line last:border-b-0"
          >
            <span
              className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                passo.feito ? "bg-grass text-white" : "border-2 border-line text-ink-faint"
              }`}
            >
              {passo.feito ? "✓" : ""}
            </span>
            <div className="flex-1 min-w-0">
              <b className={`text-[13.5px] block ${passo.feito ? "text-ink-faint line-through" : ""}`}>
                {passo.titulo}
              </b>
              {!passo.feito && (
                <span className="text-[12.5px] text-ink-soft">{passo.descricao}</span>
              )}
            </div>
            {!passo.feito && (
              <Link
                href={passo.href}
                className="text-[12px] font-semibold border border-line rounded-sm px-2.5 py-1.5 shrink-0 hover:border-pitch-dark"
              >
                Fazer
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
