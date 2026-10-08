import { requirePlatformAdmin } from "@/lib/platform/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

// Página-reserva: o menu aponta para cá desde já, e a fase de contratos a substitui.
export default async function AdminContratosPage() {
  await requirePlatformAdmin();
  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader title="Contratos" description="Acordos comerciais de cada clube com a plataforma." />
      <EmptyState icon="📄" message="Em construção nesta fase." />
    </div>
  );
}
