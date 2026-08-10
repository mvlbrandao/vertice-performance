import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { NewChargeModal } from "@/components/billing/NewChargeModal";
import { ChargesList } from "@/components/billing/ChargesList";
import { GuardianBillingForm } from "@/components/billing/GuardianBillingForm";
import { NewRecurringBillingModal } from "@/components/billing/NewRecurringBillingModal";
import { RecurringBillingCard } from "@/components/billing/RecurringBillingCard";
import { BillingRulesCard } from "@/components/billing/BillingRulesCard";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AthleteFinanceiroPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const supabase = await createClient();

  const [{ data: charges }, { data: athlete }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("due_date", { ascending: false }),
    supabase
      .from("athletes")
      .select("guardian_cpf, guardian_email, asaas_customer_id")
      .eq("id", athleteId)
      .single(),
    supabase
      .from("athlete_billing_subscriptions")
      .select("id, asaas_subscription_id, billing_type, amount_cents, description, status, checkout_url")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false }),
  ]);

  // Soma o valor líquido (amount_cents - discount_cents) — o desconto já
  // reduz o que realmente entra, então os totais têm que refletir isso.
  const pendingTotal = (charges ?? [])
    .filter((c) => c.status === "Pendente" || c.status === "Atrasado")
    .reduce((sum, c) => sum + (c.amount_cents - c.discount_cents), 0);
  const paidTotal = (charges ?? [])
    .filter((c) => c.status === "Pago")
    .reduce((sum, c) => sum + (c.amount_cents - c.discount_cents), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-[19px] m-0">Financeiro</h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Lançamentos de mensalidade e pagamentos do atleta.
          </div>
        </div>
        <div className="flex gap-2">
          {athlete?.guardian_cpf && athlete?.guardian_email && (
            <NewRecurringBillingModal athleteId={athleteId} />
          )}
          <NewChargeModal athleteId={athleteId} />
        </div>
      </div>

      <RecurringBillingCard
        athleteId={athleteId}
        subscriptions={(subscriptions ?? []).map((s) => ({
          id: s.id,
          asaasSubscriptionId: s.asaas_subscription_id,
          billingType: s.billing_type,
          amountCents: s.amount_cents,
          description: s.description,
          status: s.status,
          checkoutUrl: s.checkout_url,
        }))}
      />

      <BillingRulesCard asaasCustomerId={athlete?.asaas_customer_id ?? null} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Em aberto</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(pendingTotal)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Pago</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(paidTotal)}
          </b>
        </Card>
      </div>

      <ChargesList
        charges={(charges ?? []).map((c) => ({ ...c, athlete_id: athleteId }))}
      />

      {(!athlete?.guardian_cpf || !athlete?.guardian_email) && (
        <Card className="mt-4">
          <h4 className="mt-0 mb-2 text-sm">Cobrança recorrente (cartão/PIX/boleto)</h4>
          <GuardianBillingForm athleteId={athleteId} />
        </Card>
      )}
    </div>
  );
}
