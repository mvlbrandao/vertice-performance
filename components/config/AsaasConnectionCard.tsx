"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input } from "@/components/ui/Field";
import { connectClubAsaas, disconnectClubAsaasAction } from "@/lib/actions/clubAsaas";

/**
 * Conexão da conta Asaas do clube. Antes existia só um "testar conexão"
 * sobre a chave do ambiente — a nossa, igual pra todo mundo. Agora cada
 * clube cola a própria chave, e é o dinheiro dele que passa a cair na
 * conta dele.
 */
export function AsaasConnectionCard({
  connected,
  accountName,
  connectedAt,
  sandbox,
  webhookPath,
  baseUrl,
}: {
  connected: boolean;
  accountName: string | null;
  connectedAt: string | null;
  sandbox: boolean;
  webhookPath: string | null;
  baseUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const webhookUrl = webhookPath ? `${baseUrl}${webhookPath}` : null;

  async function handleConnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await connectClubAsaas(new FormData(e.currentTarget));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDisconnect() {
    setPending(true);
    await disconnectClubAsaasAction();
    setPending(false);
    setConfirmingDisconnect(false);
    router.refresh();
  }

  async function copyWebhook() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!connected) {
    return (
      <form onSubmit={handleConnect} className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-soft m-0">
          Cole a chave de API da conta Asaas <b>do seu clube</b>. Ela fica em Integrações → API,
          no painel do Asaas. As cobranças dos responsáveis passam a cair nessa conta.
        </p>
        <Field label="Chave de API do Asaas">
          <Input
            name="apiKey"
            type="password"
            required
            autoComplete="off"
            placeholder="$aact_..."
          />
        </Field>
        {error && <p className="text-clay text-[13px] font-medium m-0">{error}</p>}
        <div>
          <Button variant="solid" size="sm" type="submit" disabled={pending}>
            {pending ? "Validando com o Asaas…" : "Conectar conta"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone="green">Conectado</Badge>
        {sandbox && <Badge tone="amber">Sandbox</Badge>}
        {accountName && <span className="text-[13px] font-semibold">{accountName}</span>}
        {connectedAt && (
          <span className="text-[11px] text-ink-faint font-mono">
            desde {new Date(connectedAt).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {sandbox && (
        <p className="text-[12.5px] text-clay bg-clay/10 border border-clay/25 rounded-sm px-2.5 py-2 m-0">
          Esta é uma chave de <b>homologação</b>. As cobranças aparecem normalmente no sistema,
          mas nada é cobrado de verdade e nenhum boleto chega ao responsável.
        </p>
      )}

      {webhookUrl && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint block mb-1">
            Endereço de webhook deste clube
          </span>
          <p className="text-[12.5px] text-ink-soft m-0 mb-1.5">
            Cadastre no Asaas em Integrações → Webhooks para que o pagamento baixe sozinho aqui.
          </p>
          <div className="bg-chalk border border-line rounded-sm px-3 py-2 break-all font-mono text-[11.5px] mb-1.5">
            {webhookUrl}
          </div>
          <Button variant="outline" size="sm" onClick={copyWebhook}>
            {copied ? "✓ Copiado" : "Copiar endereço"}
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {confirmingDisconnect ? (
          <>
            <span className="text-xs text-ink-faint">
              Desconectar? As cobranças automáticas param.
            </span>
            <Button variant="danger" size="sm" onClick={handleDisconnect} disabled={pending}>
              {pending ? "…" : "Sim"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDisconnect(false)}
              disabled={pending}
            >
              Não
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDisconnect(true)}>
            Desconectar conta
          </Button>
        )}
      </div>
    </div>
  );
}
