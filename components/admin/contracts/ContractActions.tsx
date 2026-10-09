"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { activateContract, cancelContract, closeContract, renewContract } from "@/lib/actions/contracts";
import { CONTRACT_LIMITS, MIN_REASON_LENGTH, contractCode } from "@/lib/platform/contractRules";
import { formatCivilBR } from "@/lib/platform/contractView";
import type { ContractActionResult } from "@/lib/platform/contractSchema";
import type { ContractStatus } from "@/lib/types/database";

type Panel = "activate" | "close" | "cancel" | "renew" | null;

/**
 * Ações de situação do contrato: ativar, encerrar, cancelar e renovar. As
 * que não se desfazem (encerrar, cancelar) abrem um painel com o motivo
 * obrigatório em vez de um confirm() do navegador, que não dá para estilizar
 * nem ler direito num celular.
 *
 * O servidor é quem decide o que é permitido; a tela só mostra os botões que
 * fazem sentido para a situação atual.
 */
export function ContractActions({
  contractId,
  number,
  status,
  renewal,
}: {
  contractId: string;
  number: number;
  status: ContractStatus;
  /** Período do rascunho que a renovação criaria; null = não dá para renovar. */
  renewal: { startsOn: string; endsOn: string } | null;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [replace, setReplace] = useState<{ currentNumber: number } | null>(null);
  const [renewed, setRenewed] = useState<string | null>(null);

  const code = contractCode(number);

  function open(next: Panel) {
    setPanel(panel === next ? null : next);
    setError(null);
    setReplace(null);
    setReason("");
  }

  async function run(
    action: (data: FormData) => Promise<ContractActionResult>,
    extra: Record<string, string> = {},
  ): Promise<ContractActionResult | null> {
    const data = new FormData();
    data.set("contractId", contractId);
    for (const [key, value] of Object.entries(extra)) data.set(key, value);

    setPending(true);
    setError(null);
    setWarning(null);
    let result: ContractActionResult;
    try {
      result = await action(data);
    } catch {
      setPending(false);
      setError("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
      return null;
    }
    setPending(false);

    if (result.error) {
      setError(result.error);
      if (result.needsReplaceConfirmation) setReplace(result.needsReplaceConfirmation);
      return null;
    }
    if (result.warning) setWarning(result.warning);
    return result;
  }

  async function onActivate(confirmed: boolean) {
    const result = await run(activateContract, confirmed ? { replace: "true" } : {});
    if (!result) return;
    setPanel(null);
    setReplace(null);
    router.refresh();
  }

  async function onFinish(kind: "close" | "cancel") {
    const result = await run(kind === "close" ? closeContract : cancelContract, { reason });
    if (!result) return;
    setPanel(null);
    setReason("");
    router.refresh();
  }

  async function onRenew() {
    const result = await run(renewContract);
    if (!result?.contractId) return;
    setPanel(null);
    // Com aviso da trilha a tela fica, para o aviso ser lido; sem aviso, vai direto ao rascunho.
    if (result.warning) {
      setRenewed(result.contractId);
      return;
    }
    router.push(`/admin/contratos/${result.contractId}`);
  }

  const canActivate = status === "rascunho";
  const canClose = status === "vigente";
  const canCancel = status === "rascunho" || status === "vigente";
  const canRenew = renewal !== null && (status === "vigente" || status === "encerrado");

  if (!canActivate && !canClose && !canCancel && !canRenew) {
    return (
      <p className="m-0 text-[13px] text-ink-soft">
        Contrato {status === "cancelado" ? "cancelado" : "encerrado"}: somente leitura.
      </p>
    );
  }

  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canActivate && (
          <Button variant="solid" size="sm" type="button" aria-expanded={panel === "activate"} onClick={() => open("activate")}>
            Ativar
          </Button>
        )}
        {canRenew && (
          <Button variant="outline" size="sm" type="button" aria-expanded={panel === "renew"} onClick={() => open("renew")}>
            Renovar
          </Button>
        )}
        {canClose && (
          <Button variant="outline" size="sm" type="button" aria-expanded={panel === "close"} onClick={() => open("close")}>
            Encerrar
          </Button>
        )}
        {canCancel && (
          <Button variant="danger" size="sm" type="button" aria-expanded={panel === "cancel"} onClick={() => open("cancel")}>
            Cancelar contrato
          </Button>
        )}
      </div>

      {panel === "activate" && (
        <div className="rounded-sm border border-line bg-chalk p-3.5 flex flex-col gap-2.5">
          {replace ? (
            <p className="m-0 text-[13px]">
              O clube já tem o <b>{contractCode(replace.currentNumber)}</b> vigente. Confirmando, ele é encerrado como
              substituído pelo <b>{code}</b>, e o {code} passa a valer.
            </p>
          ) : (
            <p className="m-0 text-[13px]">
              O {code} passa a valer. Se o clube já tiver outro contrato vigente, você confirma a substituição no próximo passo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" size="sm" type="button" disabled={pending} onClick={() => onActivate(replace !== null)}>
              {pending ? "Ativando…" : replace ? "Confirmar substituição" : `Ativar ${code}`}
            </Button>
            <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => open(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {panel === "renew" && renewal && (
        <div className="rounded-sm border border-line bg-chalk p-3.5 flex flex-col gap-2.5">
          <p className="m-0 text-[13px]">
            Cria o rascunho do próximo período, de <b>{formatCivilBR(renewal.startsOn)}</b> a{" "}
            <b>{formatCivilBR(renewal.endsOn)}</b>, com o mesmo plano, valor e ciclo. Nada muda no {code} até você ativar o
            rascunho.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" size="sm" type="button" disabled={pending} onClick={onRenew}>
              {pending ? "Criando…" : "Criar rascunho da renovação"}
            </Button>
            <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => open(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {(panel === "close" || panel === "cancel") && (
        <form
          className="rounded-sm border border-line bg-chalk p-3.5 flex flex-col gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (reasonValid) void onFinish(panel);
          }}
        >
          <p className="m-0 text-[13px]">
            {panel === "close"
              ? `Encerrar o ${code} registra que o acordo terminou. Não dá para reabrir.`
              : `Cancelar o ${code} desfaz o acordo. Não dá para reabrir.`}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Motivo (obrigatório)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={CONTRACT_LIMITS.reason}
              required
              className="px-3 py-2.5 border border-line rounded-sm bg-white text-sm focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber w-full min-w-0 resize-y"
            />
            <span className="text-[11.5px] text-ink-faint">
              O motivo fica inteiro no contrato; a trilha de auditoria guarda só o começo. Não escreva dados pessoais.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={panel === "cancel" ? "danger" : "solid"}
              size="sm"
              type="submit"
              disabled={pending || !reasonValid}
            >
              {pending ? "Salvando…" : panel === "close" ? "Encerrar contrato" : "Cancelar contrato"}
            </Button>
            <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => open(null)}>
              Voltar
            </Button>
          </div>
        </form>
      )}

      {error && !replace && (
        <p role="alert" className="m-0 text-[13px] text-clay font-medium">
          {error}
        </p>
      )}
      {warning && (
        <p role="alert" className="text-[12.5px] font-medium m-0 px-3 py-2 rounded-sm border border-amber bg-[#FFFBE6]">
          {warning}
        </p>
      )}
      {renewed && (
        <p className="m-0 text-[13px]">
          Renovação criada.{" "}
          <Link href={`/admin/contratos/${renewed}`} className="underline font-semibold">
            Abrir o rascunho
          </Link>
        </p>
      )}
    </div>
  );
}
