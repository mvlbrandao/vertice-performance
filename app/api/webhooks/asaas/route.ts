import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChargeStatus } from "@/lib/types/database";
import { withWebhookCapture } from "@/lib/observability/webhook";

/**
 * Recebe eventos de pagamento do Asaas (cartão/PIX/boleto). Endpoint público
 * por natureza — validado pelo header "asaas-access-token" contra
 * ASAAS_WEBHOOK_TOKEN, configurado junto com o webhook no painel/API do
 * Asaas. Usa o client admin (service_role) porque não há sessão de usuário
 * numa chamada de webhook.
 */
const STATUS_MAP: Record<string, ChargeStatus> = {
  CONFIRMED: "Pago",
  RECEIVED: "Pago",
  RECEIVED_IN_CASH: "Pago",
  OVERDUE: "Atrasado",
  PENDING: "Pendente",
  AWAITING_RISK_ANALYSIS: "Pendente",
  DELETED: "Cancelado",
  REFUNDED: "Cancelado",
  CHARGEBACK_REQUESTED: "Cancelado",
};

type AsaasWebhookPayload = {
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    value: number;
    status: string;
    dueDate: string;
  };
};

async function receber(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AsaasWebhookPayload | null;
  const payment = payload?.payment;
  if (!payment) {
    return NextResponse.json({ ok: true });
  }

  const status = STATUS_MAP[payment.status] ?? "Pendente";
  const admin = createAdminClient();

  const { data: existingCharge } = await admin
    .from("athlete_charges")
    .select("id")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  if (existingCharge) {
    await admin
      .from("athlete_charges")
      .update({ status, paid_at: status === "Pago" ? new Date().toISOString() : null })
      .eq("id", existingCharge.id);
    return NextResponse.json({ ok: true });
  }

  if (!payment.subscription) {
    return NextResponse.json({ ok: true });
  }

  const { data: subscription } = await admin
    .from("athlete_billing_subscriptions")
    .select("club_id, athlete_id, description, created_by")
    .eq("asaas_subscription_id", payment.subscription)
    .maybeSingle();
  if (!subscription) {
    return NextResponse.json({ ok: true });
  }

  const dueDate = new Date(payment.dueDate);
  await admin.from("athlete_charges").insert({
    club_id: subscription.club_id,
    athlete_id: subscription.athlete_id,
    description: subscription.description,
    amount_cents: Math.round(payment.value * 100),
    competence_month: dueDate.getUTCMonth() + 1,
    competence_year: dueDate.getUTCFullYear(),
    due_date: payment.dueDate,
    status,
    paid_at: status === "Pago" ? new Date().toISOString() : null,
    asaas_payment_id: payment.id,
    asaas_subscription_id: payment.subscription,
    created_by: subscription.created_by,
  });

  return NextResponse.json({ ok: true });
}

// Exceção não tratada vira linha em system_events (source webhook) e sobe igual: o
// status, o corpo e a autenticação das respostas não mudam.
export const POST = withWebhookCapture("/api/webhooks/asaas", receber);
