"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cancelRecurringBilling } from "@/lib/actions/asaasBilling";

const BILLING_LABEL: Record<string, string> = {
  CREDIT_CARD: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
  UNDEFINED: "Escolha no checkout",
};

export function RecurringBillingCard({
  athleteId,
  subscriptions,
}: {
  athleteId: string;
  subscriptions: {
    id: string;
    asaasSubscriptionId: string;
    billingType: string;
    amountCents: number;
    description: string;
    status: "ACTIVE" | "INACTIVE";
    checkoutUrl: string | null;
  }[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const active = subscriptions.filter((s) => s.status === "ACTIVE");

  async function handleCancel(subscriptionRowId: string, asaasSubscriptionId: string) {
    setPendingId(subscriptionRowId);
    await cancelRecurringBilling(subscriptionRowId, asaasSubscriptionId, athleteId);
    setPendingId(null);
    router.refresh();
  }

  if (active.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {active.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2.5 border border-line rounded-md px-3.5 py-3 flex-wrap"
        >
          <div className="flex-1 min-w-[160px]">
            <b className="text-sm block">{s.description}</b>
            <span className="text-xs text-ink-faint">
              {(s.amountCents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              · mensal
            </span>
          </div>
          <Badge tone="sky">{BILLING_LABEL[s.billingType] ?? s.billingType}</Badge>
          <Badge tone="green">Ativa</Badge>
          {s.checkoutUrl && (
            <a
              href={s.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold border border-line rounded-sm px-2.5 py-1.5 hover:border-pitch-dark"
            >
              🔗 Link de pagamento
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={pendingId === s.id}
            onClick={() => handleCancel(s.id, s.asaasSubscriptionId)}
          >
            {pendingId === s.id ? "Cancelando…" : "Cancelar"}
          </Button>
        </div>
      ))}
    </div>
  );
}
