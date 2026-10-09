import type { ReactNode } from "react";
import { CYCLE_LABEL, monthlyEquivalentCents } from "@/lib/platform/contractRules";
import { formatCivilBR, periodLabel, pricePerCycleLabel } from "@/lib/platform/contractView";
import { formatAuditDate } from "@/lib/platform/auditLabels";
import type { ClubContractRow } from "@/lib/platform/contracts";
import { formatCents } from "@/lib/utils/money";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold">{label}</dt>
      <dd className="m-0 text-sm break-words">{children}</dd>
    </div>
  );
}

/**
 * Dados do contrato em leitura. Mostra o que o formulário edita e, nos
 * encerrados e cancelados (somente leitura), como e por que terminaram.
 */
export function ContractFacts({
  contract,
  defaultQuota,
}: {
  contract: ClubContractRow;
  defaultQuota: number;
}) {
  const closed = contract.status === "encerrado" || contract.status === "cancelado";
  return (
    <dl className="m-0 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <Fact label="Plano">{contract.plan_name}</Fact>
      <Fact label="Ciclo">{CYCLE_LABEL[contract.billing_cycle]}</Fact>
      <Fact label="Valor">
        {pricePerCycleLabel(contract.price_cents, contract.billing_cycle)}
        {contract.billing_cycle !== "mensal" && (
          <span className="block text-[11.5px] text-ink-faint">
            equivale a {formatCents(monthlyEquivalentCents(contract.price_cents, contract.billing_cycle))} por mês
          </span>
        )}
      </Fact>
      <Fact label="Período">{periodLabel(contract.starts_on, contract.ends_on)}</Fact>
      <Fact label="Renova sozinho">{contract.auto_renew ? "Sim" : "Não"}</Fact>
      <Fact label="Cota de atletas">
        {contract.max_athletes === null ? `${defaultQuota} (padrão do plano)` : contract.max_athletes}
      </Fact>
      <Fact label="Assinado em">{formatCivilBR(contract.signed_on)}</Fact>
      <Fact label="Quem assinou">
        {contract.signer_name ?? "—"}
        {contract.signer_role && <span className="block text-[11.5px] text-ink-faint">{contract.signer_role}</span>}
      </Fact>
      <Fact label="Versão dos termos">{contract.terms_version ?? "—"}</Fact>
      {closed && (
        <>
          <Fact label={contract.status === "cancelado" ? "Cancelado em" : "Encerrado em"}>
            {contract.closed_at ? formatAuditDate(contract.closed_at) : "—"}
          </Fact>
          <Fact label="Motivo">{contract.closed_reason ?? "—"}</Fact>
        </>
      )}
      <div className="sm:col-span-2 lg:col-span-3 min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold">Notas internas</dt>
        <dd className="m-0 text-sm whitespace-pre-wrap break-words">{contract.notes ?? "—"}</dd>
      </div>
    </dl>
  );
}
