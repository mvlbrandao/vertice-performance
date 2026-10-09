import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  CYCLE_LABEL,
  monthlyEquivalentCents,
  type ContractDivergence,
  type ContractForComparison,
  type LicenseSnapshot,
} from "@/lib/platform/contractRules";
import { formatCivilBR } from "@/lib/platform/contractView";
import { formatCents } from "@/lib/utils/money";
import type { ClubStatus } from "@/lib/types/database";

const CLUB_STATUS_LABEL: Record<ClubStatus, string> = {
  trial: "Em teste",
  ativo: "Ativo",
  atrasado: "Em atraso",
  bloqueado: "Bloqueado",
  cancelado: "Cancelado",
};

/**
 * "Contrato x Licença atual". A licença (situação do clube, cortesia, preço e
 * cota) é quem manda no acesso; o contrato é o registro comercial. Este painel
 * não corrige nada: mostra os dois lado a lado e explica cada divergência, e
 * quem decide o que fazer é o dono (a licença se ajusta em Clubes).
 */
export function ContractLicensePanel({
  contract,
  license,
  divergences,
  clubSlug,
  defaultQuota,
}: {
  contract: ContractForComparison;
  license: LicenseSnapshot | null;
  divergences: ContractDivergence[];
  clubSlug: string | null;
  defaultQuota: number;
}) {
  if (!license) {
    return (
      <p className="m-0 text-[13px] text-ink-soft">
        O clube deste contrato não existe mais, então não há licença para comparar.
      </p>
    );
  }

  // Encerrado e cancelado são o retrato do que foi combinado no passado: comparar
  // com a licença de hoje não diz nada, e "estão de acordo" seria uma mentira.
  const historical = contract.status === "encerrado" || contract.status === "cancelado";

  const contractMonthly = monthlyEquivalentCents(contract.price_cents, contract.billing_cycle);
  const contractQuota = contract.max_athletes ?? license.defaultMaxAthletes;
  const priceDiffers = contractMonthly !== license.priceCents;
  const quotaDiffers = contractQuota !== license.maxAthletes;

  const rows: { label: string; contract: string; license: string; differs: boolean }[] = [
    {
      label: "Mensalidade",
      contract:
        contract.billing_cycle === "mensal"
          ? formatCents(contractMonthly)
          : `${formatCents(contractMonthly)} (${CYCLE_LABEL[contract.billing_cycle].toLowerCase()})`,
      license: formatCents(license.priceCents),
      differs: priceDiffers,
    },
    {
      label: "Atletas",
      contract: contract.max_athletes === null ? `${contractQuota} (padrão do plano)` : String(contractQuota),
      license: String(license.maxAthletes),
      differs: quotaDiffers,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap text-[13px]">
        <span className="text-ink-soft">Licença do clube:</span>
        <b>{CLUB_STATUS_LABEL[license.status]}</b>
        <Badge tone={license.allowed ? "green" : "clay"}>{license.allowed ? "acesso liberado" : "sem acesso"}</Badge>
        {license.courtesyActive && (
          <Badge tone="amber">cortesia até {formatCivilBR(license.courtesyUntil)}</Badge>
        )}
        {license.isDemo && <Badge tone="dark">demonstração</Badge>}
      </div>

      {historical ? (
        <p role="status" className="m-0 text-[13px] px-3 py-2 rounded-sm border border-line bg-chalk">
          Este contrato está {contract.status === "cancelado" ? "cancelado" : "encerrado"} e é só histórico: não é
          comparado com a licença atual.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse min-w-[260px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="font-semibold py-1.5 pr-3" />
                  <th scope="col" className="font-semibold py-1.5 pr-3">
                    Contrato
                  </th>
                  <th scope="col" className="font-semibold py-1.5">
                    Licença
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <th scope="row" className="text-left font-semibold py-2 pr-3 text-ink-soft">
                      {row.label}
                    </th>
                    <td className={`py-2 pr-3 ${row.differs ? "text-clay font-semibold" : ""}`}>{row.contract}</td>
                    <td className={`py-2 ${row.differs ? "text-clay font-semibold" : ""}`}>
                      {row.license}
                      {row.differs && <span className="sr-only"> (diverge do contrato)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {divergences.length === 0 ? (
            <p role="status" className="m-0 text-[13px] px-3 py-2 rounded-sm border border-line bg-chalk">
              Contrato e licença estão de acordo.
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {divergences.map((divergence) => (
                <li
                  key={divergence.code}
                  className={`text-[13px] px-3 py-2 rounded-sm border ${
                    divergence.severity === "alerta" ? "border-clay bg-[#FDE8E8]" : "border-amber bg-[#FFFBE6]"
                  }`}
                >
                  <b className="block text-[11px] uppercase tracking-wide mb-0.5">
                    {divergence.severity === "alerta" ? "Divergência" : "Atenção"}
                  </b>
                  {divergence.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="m-0 text-[11.5px] text-ink-faint">
        A licença é quem libera o acesso; o contrato não a altera. Cota padrão do plano: {defaultQuota} atletas.
        {clubSlug && (
          <>
            {" "}
            <Link href={`/admin/clubes?q=${encodeURIComponent(clubSlug)}`} className="underline font-semibold">
              Ajustar a licença do clube
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
