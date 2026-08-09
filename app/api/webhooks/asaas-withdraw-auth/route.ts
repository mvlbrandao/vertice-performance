import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mecanismo de segurança do Asaas ("Validação de saque via Webhook", em
 * Menu do usuário > Integrações > Mecanismos de segurança): o Asaas chama
 * essa URL antes de liberar QUALQUER saque, transferência, pagamento de
 * conta, recarga de celular ou estorno Pix feito via API, e espera
 * {status: "APPROVED"} ou {status: "REFUSED"} de volta.
 *
 * Este app nunca inicia nenhuma dessas operações — só cria clientes e
 * assinaturas (cobrança, não saque). Por isso a política é sempre recusar:
 * qualquer chamada aqui significa que a chave de API está sendo usada pra
 * mover dinheiro para fora por um caminho que este sistema não conhece.
 */
export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!token || token !== process.env.ASAAS_WITHDRAW_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const eventType = (payload as { type?: string } | null)?.type ?? "UNKNOWN";

  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id").limit(1).single();
  if (club) {
    await admin.from("asaas_security_events").insert({
      club_id: club.id,
      event_type: eventType,
      payload: payload ?? {},
      decision: "REFUSED",
    });
  }

  return NextResponse.json({
    status: "REFUSED",
    refuseReason: "Operação não iniciada pelo sistema Vértice Performance.",
  });
}
