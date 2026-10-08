import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { PlatformSettingsForm } from "@/components/platform/PlatformSettingsForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminConfiguracoesPage() {
  await requirePlatformAdmin();
  const settings = await getPlatformSettings();

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title="Configurações"
        description="Plano e regras comerciais que valem para todos os clubes."
      />

      <PlatformSettingsForm settings={settings} />

      <p className="text-[12.5px] text-ink-faint mt-3">
        Cada alteração fica registrada, com o antes e o depois, na{" "}
        <Link href="/admin/auditoria?acao=settings" className="underline">
          trilha de auditoria
        </Link>
        .
      </p>
    </div>
  );
}
