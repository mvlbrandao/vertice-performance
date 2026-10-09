import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CYCLE_LABEL, contractCode, monthlyEquivalentCents } from "@/lib/platform/contractRules";
import type { ContractListRow } from "@/lib/platform/contractList";
import { periodLabel, pricePerCycleLabel } from "@/lib/platform/contractView";
import { formatCents } from "@/lib/utils/money";
import { ContractExpiryBadge, ContractStatusBadge, LINK_BUTTON_OUTLINE } from "./ContractBadges";

/**
 * Um contrato na lista. Cartão empilhado no celular; de md para cima vira uma
 * linha com o dinheiro e o período alinhados à direita. É a mesma marcação nos
 * dois casos (só muda o flex), então leitor de tela e ordem de tabulação não
 * dependem do tamanho da tela.
 */
export function ContractListItem({ contract, todayISO }: { contract: ContractListRow; todayISO: string }) {
  const vigente = contract.status === "vigente";
  const semDocumento = !contract.document_path && (vigente || contract.status === "rascunho");
  const code = contractCode(contract.number);
  const [primeira, ...demais] = contract.divergences;

  return (
    <article className="bg-paper border border-line rounded-md px-3.5 py-3">
      <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <Link
              href={`/admin/contratos/${contract.id}`}
              className="font-mono font-bold text-sm underline decoration-line underline-offset-2"
            >
              {code}
            </Link>
            <ContractStatusBadge status={contract.status} />
            <ContractExpiryBadge contract={contract} todayISO={todayISO} />
            {semDocumento && <Badge tone="amber">sem documento</Badge>}
            {primeira && <Badge tone="clay">diverge da licença</Badge>}
          </div>
          <div className="text-sm font-semibold break-words">{contract.club_name}</div>
          <div className="text-[11.5px] text-ink-faint break-words">
            {contract.plan_name} · {CYCLE_LABEL[contract.billing_cycle]}
          </div>
          {primeira && (
            <p className="text-[12px] text-clay m-0 mt-1.5 break-words">
              {primeira.message}
              {demais.length > 0 && (
                <span className="text-ink-faint">
                  {" "}
                  (+{demais.length} {demais.length === 1 ? "divergência" : "divergências"})
                </span>
              )}
            </p>
          )}
        </div>

        <div className="md:text-right md:w-60 shrink-0 min-w-0">
          <div className="text-sm font-semibold">{pricePerCycleLabel(contract.price_cents, contract.billing_cycle)}</div>
          {contract.billing_cycle !== "mensal" && (
            <div className="text-[11.5px] text-ink-faint">
              equivale a {formatCents(monthlyEquivalentCents(contract.price_cents, contract.billing_cycle))} por mês
            </div>
          )}
          <div className="text-[11.5px] text-ink-faint">{periodLabel(contract.starts_on, contract.ends_on)}</div>
        </div>

        <Link
          href={`/admin/contratos/${contract.id}`}
          className={LINK_BUTTON_OUTLINE}
          aria-label={`Abrir ${code} de ${contract.club_name}`}
        >
          Abrir
        </Link>
      </div>
    </article>
  );
}
