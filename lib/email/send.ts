import "server-only";
import { Resend } from "resend";

/**
 * Reforço por e-mail pra eventos financeiros — o responsável nem sempre
 * tem o app aberto, mas confere e-mail. Segue o mesmo padrão do client do
 * Asaas: se a chave não estiver configurada, não quebra o fluxo principal,
 * só deixa de mandar (log discreto pra facilitar diagnóstico).
 */
export async function sendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY não configurada — e-mail "${input.subject}" não enviado.`);
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "Vértice Performance <no-reply@verticepf.com.br>";

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (error) {
    console.error("[email] Falha ao enviar:", error);
  }
}

function emailShell(title: string, bodyHtml: string) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px;color:#1C1912">
    <div style="background:#111111;color:#FFD600;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:800;letter-spacing:0.02em">
      VÉRTICE PERFORMANCE
    </div>
    <div style="background:#ffffff;border:1px solid #E4DCC8;border-top:none;border-radius:0 0 8px 8px;padding:22px 20px">
      <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
      ${bodyHtml}
    </div>
  </div>`;
}

export async function sendChargePaidEmail(input: {
  to: string;
  athleteName: string;
  description: string;
  amountCents: number;
}) {
  const amount = (input.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  await sendEmail({
    to: input.to,
    subject: `Pagamento confirmado — ${input.description}`,
    html: emailShell(
      "Pagamento confirmado ✅",
      `<p style="font-size:14px;line-height:1.6">Recebemos o pagamento de <b>${amount}</b> referente a "${input.description}" de <b>${input.athleteName}</b>.</p>
       <p style="font-size:13px;color:#83795F">Este é um recibo automático — guarde pra sua referência.</p>`,
    ),
  });
}

export async function sendCancellationReviewedEmail(input: {
  to: string;
  athleteName: string;
  approved: boolean;
}) {
  await sendEmail({
    to: input.to,
    subject: input.approved
      ? `Cancelamento aprovado — ${input.athleteName}`
      : `Pedido de cancelamento avaliado — ${input.athleteName}`,
    html: emailShell(
      input.approved ? "Cancelamento aprovado" : "Pedido de cancelamento avaliado",
      input.approved
        ? `<p style="font-size:14px;line-height:1.6">O pedido de cancelamento de contrato de <b>${input.athleteName}</b> foi aprovado pelo treinador. Cobranças futuras foram ajustadas conforme solicitado.</p>`
        : `<p style="font-size:14px;line-height:1.6">O pedido de cancelamento de contrato de <b>${input.athleteName}</b> não foi aprovado. Fale com o treinador pra mais detalhes.</p>`,
    ),
  });
}
