import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubIdForWebhookToken } from "@/lib/asaas/credentials";

/**
 * Webhook do Asaas, um endereço por clube.
 *
 * A rota antiga era única e autenticada por um token global do ambiente.
 * Com cada clube usando a própria conta Asaas isso não serve mais: não
 * havia como saber de qual conta veio o evento, e aceitar evento sem saber
 * de quem é significa deixar quem descobrir o token marcar a cobrança de
 * qualquer clube como paga. O token no caminho identifica e autentica ao
 * mesmo tempo — é aleatório, único, e só quem conectou a conta o recebe.
 *
 * O clube cola este endereço no painel dele do Asaas, em Integrações.
 */
type Payload = {
  event?: string;
  payment?: {
    id?: string;
    subscription?: string;
    value?: number;
    status?: string;
  };
};

const PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const ATRASADO = new Set(["PAYMENT_OVERDUE"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let clubId: string | null;
  try {
    clubId = await clubIdForWebhookToken(token);
  } catch (e) {
    console.error("[webhook asaas] falha ao resolver o clube:", (e as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // 404 e não 401: um token que não existe não deve revelar que a rota
  // sequer avalia tokens.
  if (!clubId) return NextResponse.json({ error: "not found" }, { status: 404 });

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload?.event || !payload.payment?.id) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Registra sempre, inclusive evento que não muda nada: sem esse rastro,
  // divergência entre o que o Asaas diz e o que o sistema mostra vira
  // discussão sem prova.
  await admin.from("asaas_security_events").insert({
    club_id: clubId,
    event_type: payload.event,
    payload: payload as never,
    decision: "recebido",
  });

  const novoStatus = PAGO.has(payload.event)
    ? "Pago"
    : ATRASADO.has(payload.event)
      ? "Atrasado"
      : null;

  if (novoStatus) {
    // Restringe pelo clube dono do token: um evento nunca pode mexer na
    // cobrança de outro clube, mesmo que traga um id que exista lá.
    await admin
      .from("athlete_charges")
      .update({
        status: novoStatus,
        paid_at: novoStatus === "Pago" ? new Date().toISOString() : null,
      })
      .eq("club_id", clubId)
      .eq("asaas_payment_id", payload.payment.id);
  }

  return NextResponse.json({ ok: true });
}
