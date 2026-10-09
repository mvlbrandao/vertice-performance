import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import {
  getContractWithClub,
  listClubContracts,
  listContractAuditTrail,
} from "@/lib/platform/contracts";
import { getPlatformSettings } from "@/lib/platform/license";
import { buildLicenseSnapshot } from "@/lib/platform/licenseSnapshot";
import {
  canChangeDocument,
  canRenew,
  compareWithLicense,
  contractCode,
  isEditable,
  nextPeriodAfter,
  type ContractDivergence,
} from "@/lib/platform/contractRules";
import { presentContractAuditDetails } from "@/lib/platform/contractAudit";
import { isUuid } from "@/lib/platform/contractSchema";
import { contractToFormValues, periodLabel, pricePerCycleLabel } from "@/lib/platform/contractView";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AuditTable } from "@/components/admin/AuditTable";
import { MigrationNotice } from "@/components/admin/MigrationNotice";
import { ContractActions } from "@/components/admin/contracts/ContractActions";
import {
  ContractExpiryBadge,
  ContractStatusBadge,
  LINK_BUTTON_OUTLINE,
} from "@/components/admin/contracts/ContractBadges";
import { ContractDocumentPanel } from "@/components/admin/contracts/ContractDocumentPanel";
import { ContractFacts } from "@/components/admin/contracts/ContractFacts";
import { ContractForm } from "@/components/admin/contracts/ContractForm";
import { ContractLicensePanel } from "@/components/admin/contracts/ContractLicensePanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { hojeISO } from "@/lib/utils/date";

type Params = Promise<{ contractId: string }>;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className={`text-[17px] mt-0 ${hint ? "mb-1" : "mb-3.5"}`}>{title}</h2>
      {hint && <p className="text-[13px] text-ink-soft mt-0 mb-3.5">{hint}</p>}
      {children}
    </Card>
  );
}

export default async function AdminContratoPage({ params }: { params: Params }) {
  await requirePlatformAdmin();

  const { contractId } = await params;
  // Id malformado é "não encontrado", sem ir ao banco (o Postgres responderia
  // erro de uuid inválido e a tela viraria 500).
  if (!isUuid(contractId)) notFound();

  const found = await getContractWithClub(contractId);
  if (found.migrationPending) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <AdminPageHeader title="Contrato" />
        <MigrationNotice
          migration="0073"
          what="A tabela de contratos ainda não existe no banco, então não há contrato para mostrar."
        />
      </div>
    );
  }
  if (!found.data) notFound();

  const { contract, club } = found.data;
  const today = hojeISO();

  const [settings, history, trail] = await Promise.all([
    getPlatformSettings(),
    listClubContracts(contract.club_id),
    listContractAuditTrail(contract.club_id),
  ]);

  const code = contractCode(contract.number);
  const defaults = { priceCents: settings.priceCents, maxAthletes: settings.maxAthletes };
  const license = club ? buildLicenseSnapshot(club, defaults) : null;
  const divergences: ContractDivergence[] = license ? compareWithLicense(contract, license) : [];
  const otherActive = history.data.find((c) => c.status === "vigente" && c.id !== contract.id) ?? null;
  const others = history.data.filter((c) => c.id !== contract.id);

  const editable = isEditable(contract.status);
  const next = canRenew(contract) ? nextPeriodAfter(contract) : null;

  const trailRows = trail.data.map((row) => ({ ...row, details: presentContractAuditDetails(row.details) }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title={code}
        description={club ? club.name : "Clube removido"}
        actions={
          <Link href="/admin/contratos" className={LINK_BUTTON_OUTLINE}>
            ← Contratos
          </Link>
        }
      />

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <ContractStatusBadge status={contract.status} />
        <ContractExpiryBadge contract={contract} todayISO={today} />
        {contract.status !== "cancelado" && !contract.document_path && <Badge tone="amber">sem documento</Badge>}
        {divergences.length > 0 && <Badge tone="clay">diverge da licença</Badge>}
        <span className="text-[12.5px] text-ink-soft">
          {contract.plan_name} · {pricePerCycleLabel(contract.price_cents, contract.billing_cycle)} ·{" "}
          {periodLabel(contract.starts_on, contract.ends_on)}
        </span>
      </div>

      {contract.status === "rascunho" && otherActive && (
        <p className="text-[13px] mb-4 px-3 py-2 rounded-sm border border-amber bg-[#FFFBE6] m-0" role="status">
          O clube já tem o{" "}
          <Link href={`/admin/contratos/${otherActive.id}`} className="underline font-semibold">
            {contractCode(otherActive.number)}
          </Link>{" "}
          vigente. Ao ativar este rascunho, o {contractCode(otherActive.number)} será encerrado como substituído (você
          confirma antes).
        </p>
      )}

      {trail.migrationPending && (
        <div className="mb-4">
          <MigrationNotice
            migration="0072"
            what="A trilha de auditoria ainda não existe no banco, então as alterações deste contrato NÃO ficam registradas."
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Section
            title={editable ? "Dados do contrato" : "Dados do contrato (somente leitura)"}
            hint={
              editable
                ? undefined
                : "Contrato encerrado ou cancelado é o retrato do que foi combinado: não se edita."
            }
          >
            {editable ? (
              // Sem `key`: remontar o formulário depois de salvar apagaria o "salvo"
              // e o aviso de que a trilha não gravou. Os campos já guardam o que
              // foi digitado, que é o que acabou de ser gravado.
              <ContractForm
                mode="edit"
                contractId={contract.id}
                status={contract.status as "rascunho" | "vigente"}
                values={contractToFormValues(contract)}
                defaultQuota={settings.maxAthletes}
              />
            ) : (
              <ContractFacts contract={contract} defaultQuota={settings.maxAthletes} />
            )}
          </Section>

          <Section
            title="Contrato x Licença atual"
            hint="Compara o que foi combinado com o que a licença do clube faz valer hoje."
          >
            <ContractLicensePanel
              contract={contract}
              license={license}
              divergences={divergences}
              clubSlug={club?.slug ?? null}
              defaultQuota={settings.maxAthletes}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Section title="Situação">
            <ContractActions
              contractId={contract.id}
              number={contract.number}
              status={contract.status}
              renewal={next ? { startsOn: next.starts_on, endsOn: next.ends_on } : null}
            />
          </Section>

          <Section title="Documento assinado">
            <ContractDocumentPanel
              contractId={contract.id}
              number={contract.number}
              hasDocument={!!contract.document_path}
              editable={canChangeDocument(contract.status)}
            />
          </Section>

          {others.length > 0 && (
            <Section title="Outros contratos do clube">
              <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                {others.map((other) => (
                  <li key={other.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/admin/contratos/${other.id}`}
                        className="font-mono font-bold text-sm underline decoration-line underline-offset-2"
                      >
                        {contractCode(other.number)}
                      </Link>
                      <ContractStatusBadge status={other.status} />
                    </div>
                    <span className="text-[11.5px] text-ink-faint">
                      {pricePerCycleLabel(other.price_cents, other.billing_cycle)} ·{" "}
                      {periodLabel(other.starts_on, other.ends_on)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <section className="mt-6" aria-labelledby="trilha-titulo">
        <h2 id="trilha-titulo" className="text-[17px] mt-0 mb-1">
          Trilha de auditoria dos contratos do clube
        </h2>
        <p className="text-[13px] text-ink-soft mt-0 mb-3">
          Só ações de contrato deste clube, mais novas primeiro (até 30). A trilha completa está em{" "}
          <Link href={club ? `/admin/auditoria?clube=${club.id}` : "/admin/auditoria"} className="underline font-semibold">
            Auditoria
          </Link>
          .
        </p>
        {!trail.migrationPending && <AuditTable rows={trailRows} />}
      </section>
    </div>
  );
}
