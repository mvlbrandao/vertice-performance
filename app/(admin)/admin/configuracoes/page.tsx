import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { isAuditTrailAvailable } from "@/lib/platform/audit";
import { getPlatformSettings } from "@/lib/platform/license";
import { PlatformSettingsForm } from "@/components/platform/PlatformSettingsForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MigrationNotice } from "@/components/admin/MigrationNotice";

export default async function AdminConfiguracoesPage() {
  await requirePlatformAdmin();
  const [settings, auditAvailable] = await Promise.all([getPlatformSettings(), isAuditTrailAvailable()]);

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title="Configurações"
        description="Plano e regras comerciais que valem para todos os clubes."
      />

      {!auditAvailable && (
        <div className="mb-3">
          <MigrationNotice
            migration="0072"
            what="A trilha de auditoria ainda não existe no banco, então as alterações feitas aqui NÃO ficam registradas."
          />
        </div>
      )}

      <PlatformSettingsForm settings={settings} />

      {auditAvailable && (
        <p className="text-[12.5px] text-ink-faint mt-3">
          Cada alteração fica registrada, com o antes e o depois, na{" "}
          <Link href="/admin/auditoria?acao=settings" className="underline">
            trilha de auditoria
          </Link>
          .
        </p>
      )}
    </div>
  );
}
