import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChargeStatus } from "@/lib/types/database";

/**
 * Eventos de pagamento da conta Asaas DA PLATAFORMA (nós cobrando o
 * clube) — endpoint próprio e token próprio (ASAAS_PLATFORM_WEBHOOK_TOKEN),
 * separados do webhook de app/api/webhooks/asaas/route.ts, que é o clube
 * cobrando os responsáveis na conta Asaas dele. São contas Asaas
 * diferentes, cada uma com seu próprio cadastro de webhook no painel Asaas.
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

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!token || token !== process.env.ASAAS_PLATFORM_WEBHOOK_TOKEN) {
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
    .from("platform_charges")
    .select("id, club_id")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  let clubId = existingCharge?.club_id ?? null;

  if (existingCharge) {
    await admin
      .from("platform_charges")
      .update({ status, paid_at: status === "Pago" ? new Date().toISOString() : null })
      .eq("id", existingCharge.id);
  } else if (payment.subscription) {
    const { data: club } = await admin
      .from("clubs")
      .select("id")
      .eq("asaas_subscription_id", payment.subscription)
      .maybeSingle();

    if (club) {
      clubId = club.id;
      await admin.from("platform_charges").insert({
        club_id: club.id,
        description: "Assinatura Vértice",
        amount_cents: Math.round(payment.value * 100),
        due_date: payment.dueDate,
        status,
        paid_at: status === "Pago" ? new Date().toISOString() : null,
        asaas_payment_id: payment.id,
        asaas_subscription_id: payment.subscription,
      });
    }
  }

  if (!clubId) {
    return NextResponse.json({ ok: true });
  }

  // Automatiza o que hoje é botão manual em ClubAdminRow: pagamento
  // confirmado libera o clube, atraso mostra o aviso (mesma semântica de
  // lib/platform/license.ts, onde ativo e atrasado seguem entrando).
  if (status === "Pago") {
    const { data: club } = await admin.from("clubs").select("converted_at").eq("id", clubId).maybeSingle();
    await admin
      .from("clubs")
      .update({
        status: "ativo",
        converted_at: club?.converted_at ?? new Date().toISOString(),
      })
      .eq("id", clubId);
  } else if (status === "Atrasado") {
    await admin.from("clubs").update({ status: "atrasado" }).eq("id", clubId);
  }

  return NextResponse.json({ ok: true });
}
