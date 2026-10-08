import { requirePlatformAdmin } from "@/lib/platform/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

// Página-reserva: o menu aponta para cá desde já, e a fase de saúde técnica a substitui.
export default async function AdminSaudePage() {
  await requirePlatformAdmin();
  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader title="Saúde técnica" description="Erros e desempenho do sistema." />
      <EmptyState icon="🩺" message="Em construção nesta fase." />
    </div>
  );
}
