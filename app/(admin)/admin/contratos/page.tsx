import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAllContracts, listClubsForContracts } from "@/lib/platform/contracts";
import { getPlatformSettings } from "@/lib/platform/license";
import { computeContractKpis } from "@/lib/platform/contractMetrics";
import {
  contractsHref,
  filterContracts,
  hasActiveContractFilters,
  parseContractFilters,
} from "@/lib/platform/contractFilters";
import { buildContractListRows, clubsWithoutActiveContract } from "@/lib/platform/contractList";
import { listCapNotice } from "@/lib/platform/contractView";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Kpi } from "@/components/admin/Kpi";
import { MigrationNotice } from "@/components/admin/MigrationNotice";
import { ContractFiltersForm } from "@/components/admin/contracts/ContractFilters";
import { ContractListItem } from "@/components/admin/contracts/ContractListItem";
import { LINK_BUTTON_AMBER } from "@/components/admin/contracts/ContractBadges";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents } from "@/lib/utils/money";
import { hojeISO } from "@/lib/utils/date";

type Raw = string | string[] | undefined;
type Search = Promise<{ q?: Raw; status?: Raw; vencimento?: Raw; ciclo?: Raw; documento?: Raw }>;

/** Desenhar centenas de cartões trava o celular; acima disto, manda refinar o filtro. */
const LIST_CAP = 200;
/** Quantos clubes sem contrato aparecem como atalho antes de resumir. */
const MISSING_SHOWN = 12;

const KPI_LINK_CLASS =
  "block rounded-md transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2";

export default async function AdminContratosPage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();

  const filters = parseContractFilters(await searchParams);

  const header = (
    <AdminPageHeader
      title="Contratos"
      description="Acordos comerciais de cada clube com a plataforma. A licença do clube continua mandando no acesso; o contrato é o registro do que foi combinado."
      actions={
        <Link href="/admin/contratos/novo" className={LINK_BUTTON_AMBER}>
          Novo contrato
        </Link>
      }
    />
  );

  const contractsResult = await listAllContracts();
  if (contractsResult.migrationPending) {
    return (
      <div className="max-w-[1200px] mx-auto">
        {header}
        <MigrationNotice
          migration="0073"
          what="A tabela de contratos ainda não existe no banco, então não há como listar nem criar contratos."
        />
      </div>
    );
  }

  const [clubs, settings] = await Promise.all([listClubsForContracts(), getPlatformSettings()]);
  const today = hojeISO();
  const defaults = { priceCents: settings.priceCents, maxAthletes: settings.maxAthletes };
  const now = new Date();

  const rows = buildContractListRows(contractsResult.data, clubs, defaults, now);
  const kpis = computeContractKpis(rows, today);
  const visible = filterContracts(rows, filters, today);
  const shown = visible.slice(0, LIST_CAP);
  const capNotice = listCapNotice(shown.length, visible.length);
  const filtering = hasActiveContractFilters(filters);
  const missing = clubsWithoutActiveContract(clubs, rows, defaults, now);

  return (
    <div className="max-w-[1200px] mx-auto">
      {header}

      <section aria-label="Indicadores" className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
        <Link href={contractsHref({ status: "vigente" })} className={KPI_LINK_CLASS}>
          <Kpi label="Contratos vigentes" value={String(kpis.vigentes)} />
        </Link>
        <Kpi
          label="Receita mensal"
          value={formatCents(kpis.receitaMensalCents)}
          hint="equivalente dos vigentes (anual ÷ 12)"
        />
        <Link href={contractsHref({ vencimento: "30" })} className={KPI_LINK_CLASS}>
          <Kpi
            label="Vencem em 30 dias"
            value={String(kpis.vencem30)}
            hint={
              kpis.vencidos > 0
                ? `mais ${kpis.vencidos} ${kpis.vencidos === 1 ? "vencido" : "vencidos"} sem encerrar`
                : undefined
            }
          />
        </Link>
        <Link href={contractsHref({ status: "vigente", documento: "sem" })} className={KPI_LINK_CLASS}>
          <Kpi label="Sem documento" value={String(kpis.semDocumento)} hint="vigentes sem o PDF assinado" />
        </Link>
        <Link href={contractsHref({ status: "rascunho" })} className={KPI_LINK_CLASS}>
          <Kpi label="Rascunhos" value={String(kpis.rascunhos)} />
        </Link>
      </section>

      {kpis.vencidos > 0 && (
        <p className="text-[13px] mb-3 px-3 py-2 rounded-sm border border-clay bg-[#FDE8E8] m-0" role="status">
          <b>{kpis.vencidos}</b> {kpis.vencidos === 1 ? "contrato vigente está vencido" : "contratos vigentes estão vencidos"}:
          renove ou encerre.{" "}
          <Link href={contractsHref({ vencimento: "vencidos" })} className="underline font-semibold">
            Ver vencidos
          </Link>
        </p>
      )}

      {missing.length > 0 && (
        <Card className="mb-4 !p-4 border-amber bg-[#FFFBE6]">
          <b className="block text-sm mb-1">
            {missing.length} {missing.length === 1 ? "clube pagante sem contrato vigente" : "clubes pagantes sem contrato vigente"}
          </b>
          <p className="text-[13px] text-ink-soft mt-0 mb-2.5">
            A licença cobra, mas o acordo comercial não está registrado. Crie o contrato para o clube.
          </p>
          <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
            {missing.slice(0, MISSING_SHOWN).map((club) => (
              <li key={club.id}>
                <Link
                  href={`/admin/contratos/novo?clubId=${club.id}`}
                  className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-pitch-dark pointer-coarse:min-h-11"
                >
                  {club.name}
                  {club.status === "atrasado" && <span className="ml-1.5 text-clay">em atraso</span>}
                </Link>
              </li>
            ))}
          </ul>
          {missing.length > MISSING_SHOWN && (
            <p className="text-[12px] text-ink-faint mt-2 mb-0">e mais {missing.length - MISSING_SHOWN}.</p>
          )}
        </Card>
      )}

      <ContractFiltersForm filters={filters} />

      <p className="text-[12px] text-ink-faint mt-0 mb-2.5" aria-live="polite">
        {filtering
          ? `${visible.length} de ${rows.length} ${rows.length === 1 ? "contrato" : "contratos"}`
          : `${rows.length} ${rows.length === 1 ? "contrato" : "contratos"}`}
      </p>

      {shown.length === 0 ? (
        <EmptyState
          icon="📄"
          message={
            filtering
              ? "Nenhum contrato com esses filtros."
              : "Nenhum contrato ainda. Use “Novo contrato” para registrar o primeiro."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((contract) => (
            <ContractListItem key={contract.id} contract={contract} todayISO={today} />
          ))}
        </div>
      )}

      {capNotice && <p className="text-[12.5px] text-ink-faint mt-3">{capNotice}</p>}
    </div>
  );
}
