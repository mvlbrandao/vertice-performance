import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCustomerNotifications, AsaasError } from "@/lib/asaas/client";

const EVENT_LABEL: Record<string, string> = {
  PAYMENT_CREATED: "Cobrança criada",
  PAYMENT_UPDATED: "Cobrança atualizada",
  SEND_LINHA_DIGITAVEL: "Envio da linha digitável (boleto)",
  PAYMENT_DUEDATE_WARNING: "Aviso de vencimento",
  PAYMENT_OVERDUE: "Cobrança vencida",
  PAYMENT_RECEIVED: "Pagamento confirmado",
};

const EVENT_ORDER = [
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "SEND_LINHA_DIGITAVEL",
  "PAYMENT_DUEDATE_WARNING",
  "PAYMENT_OVERDUE",
  "PAYMENT_RECEIVED",
];

function eventLabel(event: string) {
  return EVENT_LABEL[event] ?? event.replaceAll("_", " ").toLowerCase();
}

function timingLabel(event: string, offset: number): string | null {
  if (event === "PAYMENT_DUEDATE_WARNING") {
    return offset === 0 ? "No dia do vencimento" : `${offset} dia${offset > 1 ? "s" : ""} antes do vencimento`;
  }
  if (event === "PAYMENT_OVERDUE") {
    return offset === 0 ? "No dia seguinte ao vencimento" : `${offset} dia${offset > 1 ? "s" : ""} após o vencimento`;
  }
  return null;
}

function ChannelBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-sm border ${
        active
          ? "border-pitch-dark bg-pitch-dark text-white"
          : "border-line text-ink-faint"
      }`}
    >
      {label}
    </span>
  );
}

export async function BillingRulesCard({ asaasCustomerId }: { asaasCustomerId: string | null }) {
  if (!asaasCustomerId || !process.env.ASAAS_API_KEY) return null;

  let notifications;
  try {
    notifications = await getCustomerNotifications(asaasCustomerId);
  } catch (e) {
    const message = e instanceof AsaasError ? e.message : "Não foi possível buscar a régua de cobrança.";
    return (
      <Card className="mb-4">
        <h4 className="mt-0 mb-2 text-sm">📣 Régua de cobrança (Asaas)</h4>
        <div className="bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px]">
          {message}
        </div>
      </Card>
    );
  }

  if (notifications.length === 0) return null;

  const sorted = [...notifications].sort(
    (a, b) => EVENT_ORDER.indexOf(a.event) - EVENT_ORDER.indexOf(b.event),
  );

  return (
    <Card className="mb-4">
      <h4 className="mt-0 mb-1 text-sm">📣 Régua de cobrança (Asaas)</h4>
      <p className="text-[11.5px] text-ink-faint mt-0 mb-3">
        Lembretes automáticos configurados para este responsável. Editar aqui não é possível —
        ajuste no painel do Asaas se precisar mudar.
      </p>
      <div className="flex flex-col gap-2">
        {sorted.map((n) => {
          const timing = timingLabel(n.event, n.scheduleOffset);
          return (
            <div
              key={n.id}
              className="flex items-center gap-2.5 border border-line rounded-md px-3 py-2.5 flex-wrap"
            >
              <div className="flex-1 min-w-[180px]">
                <b className="text-[12.5px] block capitalize">{eventLabel(n.event)}</b>
                {timing && <span className="text-[11px] text-ink-faint">{timing}</span>}
              </div>
              <Badge tone={n.enabled ? "green" : "dark"}>{n.enabled ? "Ativo" : "Inativo"}</Badge>
              <div className="flex gap-1">
                <ChannelBadge label="E-mail" active={n.enabled && n.emailEnabledForCustomer} />
                <ChannelBadge label="SMS" active={n.enabled && n.smsEnabledForCustomer} />
                <ChannelBadge label="WhatsApp" active={n.enabled && n.whatsappEnabledForCustomer} />
                <ChannelBadge label="Ligação" active={n.enabled && n.phoneCallEnabledForCustomer} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
