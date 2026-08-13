"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  extendTrial,
  grantCourtesy,
  revokeCourtesy,
  setClubOverrides,
  setClubStatus,
} from "@/lib/actions/platformAdmin";
import type { ClubStatus } from "@/lib/types/database";

interface Club {
  id: string;
  name: string;
  slug: string;
  status: ClubStatus;
  trial_ends_at: string | null;
  courtesy_until: string | null;
  courtesy_reason: string | null;
  max_athletes_override: number | null;
  price_cents_override: number | null;
  asaas_account_name: string | null;
  is_demo: boolean;
  created_at: string;
}

const TONE: Record<ClubStatus, "green" | "sky" | "amber" | "clay" | "dark"> = {
  ativo: "green",
  trial: "sky",
  atrasado: "amber",
  bloqueado: "clay",
  cancelado: "dark",
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function ClubAdminRow({
  club,
  atletasAtivos,
  cotaPadrao,
  precoPadraoCents,
}: {
  club: Club;
  atletasAtivos: number;
  cotaPadrao: number;
  precoPadraoCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cota = club.max_athletes_override ?? cotaPadrao;
  const preco = club.price_cents_override ?? precoPadraoCents;
  const cortesiaAtiva = !!club.courtesy_until && new Date(club.courtesy_until) > new Date();
  const diasTeste = club.status === "trial" ? diasAte(club.trial_ends_at) : null;
  const lotado = atletasAtivos >= cota;

  async function run(action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData) {
    setPending(true);
    setError(null);
    fd.set("clubId", club.id);
    const result = await action(fd);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-paper border border-line rounded-md px-3.5 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <b className="text-sm">{club.name}</b>
            <Badge tone={TONE[club.status]}>{club.status}</Badge>
            {cortesiaAtiva && <Badge tone="amber">cortesia</Badge>}
            {club.is_demo && <Badge tone="dark">demo</Badge>}
            {diasTeste !== null && (
              <span className={`text-[11px] font-semibold ${diasTeste <= 3 ? "text-clay" : "text-ink-faint"}`}>
                {diasTeste > 0 ? `${diasTeste}d de teste` : "teste vencido"}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-ink-faint font-mono">
            /c/{club.slug} · <span className={lotado ? "text-clay font-bold" : ""}>{atletasAtivos}/{cota} atletas</span> ·{" "}
            {formatCents(preco)}/mês
            {club.asaas_account_name && ` · Asaas: ${club.asaas_account_name}`}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "Gerenciar"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-3.5">
          {error && <p className="text-clay text-[12.5px] font-medium m-0">{error}</p>}

          <form
            action={(fd) => run(extendTrial, fd)}
            className="flex items-end gap-2 flex-wrap"
          >
            <Field label="Estender teste (dias)">
              <Input name="dias" type="number" min={1} max={365} defaultValue={15} className="w-28" />
            </Field>
            <Button variant="outline" size="sm" type="submit" disabled={pending}>
              Estender
            </Button>
          </form>

          <form
            action={(fd) => run(grantCourtesy, fd)}
            className="flex items-end gap-2 flex-wrap"
          >
            <Field label="Cortesia até">
              <Input
                name="ate"
                type="date"
                defaultValue={club.courtesy_until?.slice(0, 10) ?? ""}
                required
              />
            </Field>
            <Field label="Motivo (opcional)">
              <Input name="motivo" defaultValue={club.courtesy_reason ?? ""} placeholder="parceria, indicação…" />
            </Field>
            <Button variant="outline" size="sm" type="submit" disabled={pending}>
              Bonificar
            </Button>
            {cortesiaAtiva && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={pending}
                onClick={() => run(revokeCourtesy, new FormData())}
              >
                Remover cortesia
              </Button>
            )}
          </form>

          <form
            action={(fd) => run(setClubOverrides, fd)}
            className="flex items-end gap-2 flex-wrap"
          >
            <Field label="Cota própria de atletas">
              <Input
                name="maxAthletes"
                type="number"
                min={1}
                defaultValue={club.max_athletes_override ?? ""}
                placeholder={`padrão: ${cotaPadrao}`}
                className="w-36"
              />
            </Field>
            <Field label="Preço próprio (R$)">
              <Input
                name="priceReais"
                inputMode="decimal"
                defaultValue={
                  club.price_cents_override != null
                    ? (club.price_cents_override / 100).toFixed(2).replace(".", ",")
                    : ""
                }
                placeholder={`padrão: ${(precoPadraoCents / 100).toFixed(2).replace(".", ",")}`}
                className="w-36"
              />
            </Field>
            <Button variant="outline" size="sm" type="submit" disabled={pending}>
              Salvar
            </Button>
            <span className="text-[11px] text-ink-faint pb-2">vazio volta ao padrão</span>
          </form>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint mr-1">
              Situação
            </span>
            {(["ativo", "trial", "atrasado", "bloqueado", "cancelado"] as ClubStatus[]).map((s) => (
              <Button
                key={s}
                variant={club.status === s ? "solid" : "ghost"}
                size="sm"
                disabled={pending || club.status === s}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("status", s);
                  run(setClubStatus, fd);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
