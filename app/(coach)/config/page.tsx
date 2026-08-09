import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolveDataRequestButton } from "@/components/privacy/ResolveDataRequestButton";
import { AsaasConnectionCard } from "@/components/config/AsaasConnectionCard";

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
  const configured = !!process.env.ASAAS_API_KEY;
  const isSandbox = (process.env.ASAAS_API_BASE_URL ?? "").includes("sandbox");
  const withdrawGuardConfigured = !!process.env.ASAAS_WITHDRAW_WEBHOOK_TOKEN;

  const [{ data: requests }, { data: securityEvents }] = await Promise.all([
    supabase
      .from("data_requests")
      .select("id, request_type, status, created_at, athletes(full_name)")
      .eq("club_id", profile!.clubId)
      .order("created_at", { ascending: false }),
    supabase
      .from("asaas_security_events")
      .select("event_type, decision, created_at")
      .eq("club_id", profile!.clubId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <h1 className="text-[28px] mb-1">Configurações & Segurança</h1>
      <div className="flex gap-2 items-start bg-chalk border border-line rounded-md px-3.5 py-3 text-[12.5px] my-4">
        <span>ℹ️</span>
        <span>
          Esta página traz os <b>controles administrativos</b> do clube: integrações, segurança e
          privacidade. O atleta vê uma versão própria, focada nos direitos sobre os dados dele.
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
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

      <Card>
        <h3 className="mt-0 mb-1">💳 Cobrança recorrente — Asaas</h3>
        <p className="text-[13px] text-ink-soft mt-0 mb-3.5 max-w-2xl">
          Cartão, PIX e boleto com cobrança automática mensal por atleta. A chave de API fica só
          no servidor — nenhum dado de cartão passa pelo nosso sistema, a cobrança do cartão
          acontece direto no checkout hospedado do Asaas.
        </p>

        {!configured ? (
          <div className="bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px]">
            Integração não configurada. Defina <code>ASAAS_API_KEY</code> e{" "}
            <code>ASAAS_API_BASE_URL</code> nas variáveis de ambiente do servidor.
          </div>
        ) : (
          <AsaasConnectionCard isSandbox={isSandbox} />
        )}

        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex items-center gap-2 mb-1">
            <b className="text-[12.5px]">Webhook de cobranças</b>
            <Badge tone="green">Configurado</Badge>
          </div>
          <p className="text-[12.5px] text-ink-soft mt-0 mb-0">
            Aponta pra <code>/api/webhooks/asaas</code> — atualiza o status do lançamento
            automaticamente quando o Asaas confirma um pagamento (cartão, PIX ou boleto).
          </p>
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-line">
          <div className="flex items-center gap-2 mb-1">
            <b className="text-[12.5px]">🛡️ Validação de saque via webhook</b>
            <Badge tone={withdrawGuardConfigured ? "green" : "amber"}>
              {withdrawGuardConfigured ? "Ativo" : "Não configurado"}
            </Badge>
          </div>
          <p className="text-[12.5px] text-ink-soft mt-0 mb-0">
            Aponta pra <code>/api/webhooks/asaas-withdraw-auth</code>. Este sistema nunca inicia
            saque, transferência, pagamento de conta ou recarga via API — só recebe cobranças. Por
            isso qualquer tentativa é <b>recusada automaticamente</b>; se aparecer algo na lista
            abaixo, é sinal de uso indevido da chave de API e vale trocar a chave no Asaas.
          </p>
          {securityEvents && securityEvents.length > 0 ? (
            <div className="mt-2.5 flex flex-col gap-1.5">
              {securityEvents.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-sm px-3 py-2 text-[12px]"
                >
                  <span>
                    ⚠️ {e.event_type} — {e.decision === "REFUSED" ? "recusado" : e.decision}
                  </span>
                  <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11.5px] text-ink-faint mt-2 mb-0">
              Nenhuma tentativa registrada até agora.
            </p>
          )}
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-line">
          <b className="text-[12.5px] block mb-1">Como configurar por atleta</b>
          <p className="text-[12.5px] text-ink-soft mt-0 mb-0">
            Na ficha do atleta, aba Financeiro, cadastre o CPF e e-mail do responsável financeiro
            e depois crie a cobrança recorrente (valor, forma de pagamento e dia de vencimento).
          </p>
        </div>
      </Card>
    </div>
  );
}
