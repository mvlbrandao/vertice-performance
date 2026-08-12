import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAthlete } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";

/**
 * Lembrete automático de cobrança. Chamado por agendamento (Vercel Cron) ou
 * manualmente com o header de autorização — nunca é público, porque manda
 * mensagem em nome do clube.
 *
 * Manda três avisos por cobrança, uma vez cada: 3 dias antes do vencimento,
 * no dia, e no dia seguinte ao vencer. Como não há tabela de "já enviei",
 * a idempotência vem de só mirar essas datas exatas — rodando uma vez por
 * dia, cada cobrança cai em cada janela no máximo uma vez.
 */
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const windows = [
    { due: addDays(today, 3), kind: "prev" as const },
    { due: today, kind: "hoje" as const },
    { due: addDays(today, -1), kind: "vencida" as const },
  ];

  const admin = createAdminClient();
  let enviados = 0;

  for (const w of windows) {
    const { data: charges } = await admin
      .from("athlete_charges")
      .select(
        "id, athlete_id, description, amount_cents, discount_cents, due_date, athletes(full_name, guardian_email, is_active)",
      )
      .in("status", ["Pendente", "Atrasado"])
      .eq("due_date", w.due);

    for (const c of charges ?? []) {
      const a = c.athletes as unknown as {
        full_name: string;
        guardian_email: string | null;
        is_active: boolean;
      } | null;
      if (!a || !a.is_active) continue;

      const valor = formatCents(c.amount_cents - (c.discount_cents ?? 0));
      const titulo =
        w.kind === "prev"
          ? "Mensalidade vence em 3 dias"
          : w.kind === "hoje"
            ? "Mensalidade vence hoje"
            : "Mensalidade venceu ontem";
      const corpo =
        w.kind === "vencida"
          ? `${c.description} · ${valor} — venceu em ${c.due_date}.`
          : `${c.description} · ${valor} — vence em ${c.due_date}.`;

      await sendPushToAthlete(c.athlete_id, {
        title: `💳 ${titulo}`,
        body: corpo,
        url: "/financeiro",
        tag: `charge-${c.id}`,
      });

      if (a.guardian_email) {
        await sendEmail({
          to: a.guardian_email,
          subject: `${titulo} — ${a.full_name}`,
          html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px;color:#1C1912">
            <div style="background:#111111;color:#FFD600;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:800">VÉRTICE PERFORMANCE</div>
            <div style="background:#fff;border:1px solid #E4DCC8;border-top:none;border-radius:0 0 8px 8px;padding:22px 20px">
              <h2 style="margin:0 0 12px;font-size:18px">${titulo}</h2>
              <p style="font-size:14px;line-height:1.6">${corpo}</p>
              <p style="font-size:13px;color:#83795F">Atleta: <b>${a.full_name}</b></p>
            </div>
          </div>`,
        });
      }
      enviados += 1;
    }
  }

  return NextResponse.json({ ok: true, enviados });
}

// O Vercel Cron dispara via GET (mandando o Authorization automaticamente
// quando CRON_SECRET está definido); o POST fica pra disparo manual.
export const GET = run;
export const POST = run;
