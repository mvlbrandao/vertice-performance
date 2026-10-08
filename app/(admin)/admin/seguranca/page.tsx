import { requirePlatformAdmin, platformAdminEmails, platformAdminRequiresMfa, readSessionAal } from "@/lib/platform/admin";
import { getAuthContext } from "@/lib/auth/session";
import { maskEmail, normalizeEmail } from "@/lib/platform/adminGate";
import { MfaManager, type MfaFactorView } from "@/components/admin/MfaManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const LEVEL_LABEL: Record<string, string> = {
  aal1: "Nível 1 — só a senha",
  aal2: "Nível 2 — senha e segundo fator",
};

export default async function AdminSegurancaPage() {
  // allowAal1: com o segundo fator obrigatório, esta é a única tela que abre
  // sem ele — é aqui que a pessoa o cadastra ou confirma.
  const admin = await requirePlatformAdmin({ allowAal1: true });
  const { supabase } = await getAuthContext();

  const [{ currentLevel }, factorsResult] = await Promise.all([
    readSessionAal(supabase),
    supabase.auth.mfa.listFactors(),
  ]);

  const factors: MfaFactorView[] = (factorsResult.data?.all ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    type: f.factor_type,
    status: f.status,
    createdAt: f.created_at,
  }));

  const allowlist = platformAdminEmails();
  const requireMfa = platformAdminRequiresMfa();
  const me = normalizeEmail(admin.email);

  return (
    <div className="max-w-[900px] mx-auto">
      <AdminPageHeader
        title="Segurança"
        description="Quem acessa a administração e como esta sessão está protegida."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-[17px] mt-0 mb-1">Quem tem acesso</h2>
          <p className="text-[13px] text-ink-soft mt-0 mb-3">
            O acesso não é um papel no banco: é a lista de e-mails da variável{" "}
            <code className="font-mono text-xs">PLATFORM_ADMIN_EMAILS</code> no servidor. Quem não
            está nela recebe a mesma página &ldquo;não encontrada&rdquo; de qualquer endereço
            inexistente.
          </p>
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {allowlist.map((email) => (
              <li key={email} className="flex items-center gap-2 flex-wrap text-[13px]">
                <span className="font-mono break-all">{maskEmail(email)}</span>
                {email === me && <Badge tone="green">você</Badge>}
              </li>
            ))}
          </ul>
          {allowlist.length > 1 && (
            <p className="text-[12.5px] text-clay font-medium mt-3 mb-0">
              Há {allowlist.length} endereços na lista. Confira se todos são de pessoas que devem
              administrar a plataforma.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-[17px] mt-0 mb-3">Esta sessão</h2>
          <dl className="m-0 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="font-semibold text-ink-soft">Conta</dt>
            <dd className="m-0 font-mono break-all">{admin.email}</dd>

            <dt className="font-semibold text-ink-soft">Lista de administradores</dt>
            <dd className="m-0">
              Configurada ({allowlist.length} {allowlist.length === 1 ? "endereço" : "endereços"})
            </dd>

            <dt className="font-semibold text-ink-soft">Nível desta sessão</dt>
            <dd className="m-0">
              {currentLevel ? (LEVEL_LABEL[currentLevel] ?? currentLevel) : "Não foi possível ler"}
            </dd>

            <dt className="font-semibold text-ink-soft">Segundo fator obrigatório</dt>
            <dd className="m-0">
              {requireMfa ? (
                "Sim (PLATFORM_ADMIN_REQUIRE_MFA=true)"
              ) : (
                <>
                  Não. Para exigir, cadastre o aplicativo abaixo e defina{" "}
                  <code className="font-mono text-xs">PLATFORM_ADMIN_REQUIRE_MFA=true</code>.
                </>
              )}
            </dd>
          </dl>
        </Card>

        <MfaManager factors={factors} currentLevel={currentLevel} requireMfa={requireMfa} />
      </div>
    </div>
  );
}
