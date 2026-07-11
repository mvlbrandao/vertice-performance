import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolveDataRequestButton } from "@/components/privacy/ResolveDataRequestButton";

const SECURITY_ITEMS = [
  "Autenticação por e-mail e senha (Supabase Auth)",
  "Criptografia de dados em repouso e em trânsito (TLS 1.3)",
  "Acesso restrito por perfil (Treinador/Atleta) via Row Level Security",
  "Fotos e vídeos armazenados em buckets privados, com URLs assinadas e de curta duração",
  "Consentimento do responsável legal registrado no cadastro do atleta",
];

export default async function CoachConfigPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("data_requests")
    .select("id, request_type, status, created_at, athletes(full_name)")
    .eq("club_id", profile!.clubId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-[28px] mb-1">Segurança & Privacidade do clube</h1>
      <div className="flex gap-2 items-start bg-chalk border border-line rounded-md px-3.5 py-3 text-[12.5px] my-4">
        <span>ℹ️</span>
        <span>
          Esta página traz os <b>controles administrativos</b> do clube. O atleta vê uma
          versão própria, focada nos direitos sobre os dados dele.
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 mb-3">Proteção de dados de menores</h3>
          <div className="flex gap-2 items-start bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px] mb-3.5">
            <span>🔒</span>
            <span>
              Perfis de atletas menores de idade têm campos sensíveis protegidos por Row
              Level Security e criptografia da infraestrutura Supabase (AES-256 / TLS 1.3).
            </span>
          </div>
          {SECURITY_ITEMS.map((label) => (
            <div
              key={label}
              className="flex justify-between items-center py-2.5 border-b border-line text-[13.5px] last:border-b-0"
            >
              <span>{label}</span>
              <Badge tone="green">Ativo</Badge>
            </div>
          ))}
        </Card>

        <Card>
          <h3 className="mt-0 mb-3">Solicitações de dados (LGPD)</h3>
          {!requests || requests.length === 0 ? (
            <EmptyState icon="📄" message="Nenhuma solicitação registrada." />
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-3 border-b border-line last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <b className="text-sm block">
                    {r.request_type === "export" ? "📄 Exportação" : "🗑️ Exclusão"} —{" "}
                    {(r.athletes as unknown as { full_name: string } | null)?.full_name}
                  </b>
                  <span className="text-xs text-ink-faint">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {r.status === "Concluído" ? (
                  <Badge tone="green">Concluído</Badge>
                ) : (
                  <ResolveDataRequestButton requestId={r.id} />
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
