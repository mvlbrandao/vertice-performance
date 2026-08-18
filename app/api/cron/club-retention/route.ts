import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { seedDemoClub, DEMO_SLUG } from "@/lib/demo/generator";

/**
 * Manutenção diária: expurgo de clube cancelado e restauração da demo.
 *
 * As duas coisas na mesma rota de propósito. O plano atual da Vercel
 * permite dois agendamentos diários, e os dois já estão ocupados
 * (lembrete de cobrança e este) — juntar aqui evita subir de plano antes
 * de haver cliente pagando, que foi a decisão do produto.
 *
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
/**
 * Tudo que carrega club_id. O que depende de atleta cai por cascade quando
 * o atleta cai, então a ordem interna não importa — só importa que atletas
 * venha antes dos perfis que os criaram.
 */
const TABELAS_DO_CLUBE = [
  "athlete_swot_items", "athlete_swot_cycles", "athlete_billing_subscriptions",
  "athlete_cancellation_requests", "athlete_charges", "athlete_club_transfers",
  "athlete_injuries", "athlete_score_snapshots", "athlete_staff_access", "audit_log",
  "athlete_planning_stage", "cash_movements", "challenge_submissions", "challenges", "checkins",
  "club_asaas_credentials", "daily_cash_closures", "data_requests", "diet_items",
  "exercise_videos", "exercises", "expenses", "expense_categories", "game_events",
  "game_lineups", "game_reports", "games", "competitions", "invite_links", "media_items",
  "meetings", "mental_notes", "plays", "sub_staff_assignments", "partner_club_categories",
  "partner_clubs", "asaas_security_events", "platform_charges", "planning_columns", "athletes",
] as const;

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
    const { data: perfis } = await admin.from("profiles").select("id").eq("club_id", club.id);
    await admin.from("clubs").update({ owner_profile_id: null }).eq("id", club.id);

    // A ordem não é a óbvia. `profiles.club_id` é RESTRICT, então o clube
    // não sai enquanto houver perfil; e `athletes.created_by` também é
    // RESTRICT, então o perfil não sai enquanto houver atleta. Apagar o
    // clube e deixar o cascade resolver trava nessa dupla — só não
    // apareceu no primeiro teste porque o clube usado não tinha atletas.
    //
    // Contas de acesso vêm por último e à parte: vivem em auth.users, fora
    // do alcance da FK, e sem isso sobrariam logins órfãos que ainda
    // autenticam e não levam a lugar nenhum.
    for (const tabela of TABELAS_DO_CLUBE) {
      const { error: tabelaError } = await admin.from(tabela).delete().eq("club_id", club.id);
      if (tabelaError) {
        console.error(`[retencao] falha ao limpar ${tabela} de ${club.name}:`, tabelaError.message);
      }
    }

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

  // Restaura a demo por último: ela é grande e demorada, e uma falha aqui
  // não pode impedir o expurgo, que é obrigação legal. Por isso o catch —
  // o resultado reporta os dois separadamente.
  let demo: string;
  try {
    const r = await seedDemoClub();
    demo = `recriada (${r.atletas} atletas, ${r.profissionais} profissionais)`;
  } catch (e) {
    console.error("[demo] falha ao restaurar:", (e as Error).message);
    demo = `falhou: ${(e as Error).message}`;
  }

  return NextResponse.json({
    ok: true,
    retencaoDias: settings.retentionDays,
    apagados,
    demo: { slug: DEMO_SLUG, resultado: demo },
  });
}

export const GET = run;
export const POST = run;
