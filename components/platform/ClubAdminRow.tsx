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
import { startClubSubscription, cancelClubSubscription } from "@/lib/actions/platformBilling";
import type { ClubStatus } from "@/lib/types/database";
import type { ClubOverdue } from "@/lib/platform/billingOverview";

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
  billing_cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  asaas_checkout_url: string | null;
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
  overdue,
}: {
  club: Club;
  atletasAtivos: number;
  cotaPadrao: number;
  precoPadraoCents: number;
  overdue: ClubOverdue | null;
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

          <div className="pt-3 border-t border-line">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint block mb-2">
              Cobrança da plataforma (sandbox)
            </span>
            {club.asaas_subscription_id ? (
              <div className="flex flex-col items-start gap-1.5 text-[12.5px]">
                <div className="flex items-center gap-1.5">
                  <span>Assinatura ativa</span>
                  {overdue ? (
                    <Badge tone="clay">
                      atrasado {overdue.maxDaysLate}d · {formatCents(overdue.totalCents)}
                    </Badge>
                  ) : (
                    <Badge tone="green">em dia</Badge>
                  )}
                </div>
                {club.asaas_checkout_url && (
                  <a
                    href={club.asaas_checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] underline break-all text-ink-faint"
                  >
                    {club.asaas_checkout_url}
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={pending}
                  onClick={() => run(cancelClubSubscription, new FormData())}
                >
                  Cancelar cobrança
                </Button>
              </div>
            ) : (
              <form
                action={(fd) => run(startClubSubscription, fd)}
                className="flex items-end gap-2 flex-wrap"
              >
                <Field label="CPF/CNPJ do responsável">
                  <Input
                    name="cpfCnpj"
                    defaultValue={club.billing_cpf_cnpj ?? ""}
                    placeholder="somente números"
                    className="w-40"
                    required
                  />
                </Field>
                <Field label="Valor (R$)">
                  <Input
                    name="amountReais"
                    inputMode="decimal"
                    defaultValue={(preco / 100).toFixed(2).replace(".", ",")}
                    className="w-28"
                    required
                  />
                </Field>
                <Field label="Forma">
                  <select
                    name="billingType"
                    defaultValue="UNDEFINED"
                    className="px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
                  >
                    <option value="UNDEFINED">A escolher</option>
                    <option value="CREDIT_CARD">Cartão</option>
                    <option value="PIX">Pix</option>
                    <option value="BOLETO">Boleto</option>
                  </select>
                </Field>
                <Button variant="outline" size="sm" type="submit" disabled={pending}>
                  Iniciar cobrança
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
