import { Card } from "@/components/ui/Card";
import { AsaasConnectionCard } from "@/components/config/AsaasConnectionCard";

export default function ConfiguracoesPage() {
  const configured = !!process.env.ASAAS_API_KEY;
  const isSandbox = (process.env.ASAAS_API_BASE_URL ?? "").includes("sandbox");

  return (
    <div>
      <h1 className="text-[28px] mb-1">Configurações</h1>
      <div className="text-xs text-ink-faint mb-6">
        Integrações e ajustes gerais do clube no sistema.
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
          <b className="text-[12.5px] block mb-1">Webhook (obrigatório pra baixa automática)</b>
          <p className="text-[12.5px] text-ink-soft mt-0 mb-0">
            Configure no painel do Asaas (Integrações → Webhooks) uma URL apontando pra{" "}
            <code>https://SEU-DOMINIO/api/webhooks/asaas</code>, eventos de pagamento, e o mesmo
            token definido em <code>ASAAS_WEBHOOK_TOKEN</code> no campo &quot;Enviar token de
            autenticação&quot;. Sem isso os pagamentos confirmados no Asaas não atualizam o status
            aqui automaticamente — precisa de uma URL pública (não funciona com localhost).
          </p>
        </div>

        <div className="mt-3.5">
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
