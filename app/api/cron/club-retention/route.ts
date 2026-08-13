import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";

/**
 * Expurgo de clube cancelado, passado o prazo de retenção.
 *
 * Não é faxina: é obrigação. A LGPD manda não guardar dado pessoal além do
 * necessário, e aqui o dado é de menor de idade — nome, foto, saúde,
 * financeiro da família. Guardar "por precaução" é o comportamento errado.
 * Também há o custo: storage de cliente que saiu continua sendo pago.
 *
 * O prazo vem de platform_settings (60 dias por padrão) e conta a partir de
 * canceled_at. Apagar o clube leva junto tudo que pende dele por cascade.
 *
 * Roda uma vez por dia. Só apaga clube com status 'cancelado' — desativar
 * um clube por engano no painel não dispara nada, porque 'bloqueado' e
 * 'cancelado' são estados distintos de propósito.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const settings = await getPlatformSettings();
  const admin = createAdminClient();

  const limite = new Date(Date.now() - settings.retentionDays * 86_400_000).toISOString();

  const { data: vencidos, error } = await admin
    .from("clubs")
    .select("id, name, canceled_at")
    .eq("status", "cancelado")
    .not("canceled_at", "is", null)
    .lt("canceled_at", limite);

  if (error) {
    console.error("[retencao] falha ao listar clubes vencidos:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const apagados: string[] = [];
  for (const club of vencidos ?? []) {
    // Contas de acesso não somem por cascade do clube: elas vivem em
    // auth.users, fora do alcance da FK. Sem isso, sobrariam logins órfãos
    // que ainda autenticam e não levam a lugar nenhum.
    const { data: perfis } = await admin.from("profiles").select("id").eq("club_id", club.id);
    await admin.from("clubs").update({ owner_profile_id: null }).eq("id", club.id);
    for (const p of perfis ?? []) {
      await admin.from("profiles").delete().eq("id", p.id);
      await admin.auth.admin.deleteUser(p.id).catch(() => {});
    }

    const { error: delError } = await admin.from("clubs").delete().eq("id", club.id);
    if (delError) {
      console.error(`[retencao] falha ao apagar ${club.name}:`, delError.message);
      continue;
    }
    apagados.push(club.name);
  }

  return NextResponse.json({ ok: true, retencaoDias: settings.retentionDays, apagados });
}

export const GET = run;
export const POST = run;
