import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { isAuditTrailAvailable } from "@/lib/platform/audit";
import { getActiveContractsByClub, listClubsForContracts } from "@/lib/platform/contracts";
import { getPlatformSettings } from "@/lib/platform/license";
import { defaultNewContractValues } from "@/lib/platform/contractView";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MigrationNotice } from "@/components/admin/MigrationNotice";
import { ContractForm, type ClubOption } from "@/components/admin/contracts/ContractForm";
import { LINK_BUTTON_OUTLINE } from "@/components/admin/contracts/ContractBadges";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { hojeISO } from "@/lib/utils/date";

type Search = Promise<{ clubId?: string | string[] }>;

export default async function AdminNovoContratoPage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();

  const { clubId } = await searchParams;
  const requested = (Array.isArray(clubId) ? clubId[0] : clubId)?.trim().toLowerCase() ?? "";

  const [clubs, active, settings, auditAvailable] = await Promise.all([
    listClubsForContracts(),
    getActiveContractsByClub(),
    getPlatformSettings(),
    isAuditTrailAvailable(),
  ]);

  const header = (
    <AdminPageHeader
      title="Novo contrato"
      description="Registra o acordo comercial de um clube com a plataforma."
      actions={
        <Link href="/admin/contratos" className={LINK_BUTTON_OUTLINE}>
          ← Contratos
        </Link>
      }
    />
  );

  if (active.migrationPending) {
    return (
      <div className="max-w-[900px] mx-auto">
        {header}
        <MigrationNotice
          migration="0073"
          what="A tabela de contratos ainda não existe no banco, então não há onde gravar o contrato."
        />
      </div>
    );
  }

  const options: ClubOption[] = clubs.map((club) => ({
    id: club.id,
    name: club.is_demo ? `${club.name} (demonstração)` : club.name,
    activeNumber: active.data.get(club.id)?.number ?? null,
  }));
  // Só pré-seleciona um clube que existe: um ?clubId= digitado errado não vira
  // um campo preenchido com valor que a lista não tem.
  const initialClubId = options.some((club) => club.id === requested) ? requested : null;

  return (
    <div className="max-w-[900px] mx-auto">
      {header}

      {!auditAvailable && (
        <div className="mb-3">
          <MigrationNotice
            migration="0072"
            what="A trilha de auditoria ainda não existe no banco, então a criação do contrato NÃO ficará registrada."
          />
        </div>
      )}

      {options.length === 0 ? (
        <EmptyState icon="🏟️" message="Nenhum clube cadastrado ainda. Crie o clube antes do contrato." />
      ) : (
        <Card>
          <ContractForm
            mode="create"
            clubs={options}
            initialClubId={initialClubId}
            values={defaultNewContractValues(settings, hojeISO())}
            defaultQuota={settings.maxAthletes}
          />
        </Card>
      )}
    </div>
  );
}
