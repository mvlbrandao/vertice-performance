import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { seedDemoClub, DEMO_SLUG, TABELAS_DO_CLUBE } from "@/lib/demo/generator";
import { withCronRun, type CronFailure, type CronOutcome } from "@/lib/observability/cronRun";
import { pruneTelemetry } from "@/lib/observability/prune";
import { removeClubContractFiles } from "@/lib/platform/clubRetentionStorage";

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
 *
 * Falha NÃO pode ser silenciosa. Em 08/10 o DELETE de um clube devolveu 409
 * (FK de announcements), a rota seguiu em frente e respondeu `ok: true`; a
 * demo ficou vazia por horas sem ninguém saber. Agora cada etapa que falha vai
 * para `falhas`, a resposta traz `ok: false` (mantendo HTTP 200: um 5xx faria
 * o agendador reexecutar o expurgo inteiro) e a execução fica em cron_runs e
 * system_events, que a tela /admin/saude mostra.
 */
type Falha = { etapa: "clube" | "contratos" | "retencao" | "demo"; clube?: string; mensagem: string };

type Resposta = { status: number; body: unknown };

async function executarRetencao(): Promise<CronOutcome<Resposta>> {
  const falhas: Falha[] = [];
  // Para system_events: sem nome de clube (o id basta), com a etapa na frase.
  const eventos: CronFailure[] = [];
  function falhou(f: Falha, clubId?: string) {
    falhas.push(f);
    eventos.push({ message: f.mensagem, clubId: clubId ?? null });
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
    // A rota devolve 500 como antes, mas isso NÃO lança: sem a falha abaixo o
    // onRequestError não veria nada e o erro ficaria só em cron_runs.
    return {
      value: { status: 500, body: { error: error.message } },
      ok: false,
      error: `falha ao listar clubes vencidos: ${error.message}`,
      failures: [{ message: `falha ao listar clubes vencidos: ${error.message}` }],
    };
  }

  const apagados: string[] = [];
  let arquivosContrato = 0;
  for (const club of vencidos ?? []) {
    const { data: perfis, error: perfisError } = await admin
      .from("profiles")
      .select("id")
      .eq("club_id", club.id);
    if (perfisError) {
      falhou({ etapa: "clube", clube: club.name, mensagem: `falha ao listar perfis do clube: ${perfisError.message}` }, club.id);
    }
    const { error: donoError } = await admin
      .from("clubs")
      .update({ owner_profile_id: null })
      .eq("id", club.id);
    if (donoError) {
      falhou({ etapa: "clube", clube: club.name, mensagem: `falha ao soltar o dono do clube: ${donoError.message}` }, club.id);
    }

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
        falhou(
          { etapa: "clube", clube: club.name, mensagem: `falha ao limpar ${tabela}: ${tabelaError.message}` },
          club.id,
        );
      }
    }

    for (const p of perfis ?? []) {
      const { error: perfilError } = await admin.from("profiles").delete().eq("id", p.id);
      if (perfilError) {
        falhou(
          { etapa: "clube", clube: club.name, mensagem: `falha ao apagar um perfil: ${perfilError.message}` },
          club.id,
        );
      }
      const { error: contaError } = await admin.auth.admin.deleteUser(p.id).catch((e: Error) => ({
        error: { message: e.message },
      }));
      if (contaError) {
        falhou(
          { etapa: "clube", clube: club.name, mensagem: `falha ao apagar uma conta de acesso: ${contaError.message}` },
          club.id,
        );
      }
    }

    // Contratos assinados ficam no storage, fora do alcance do cascade. Vem
    // ANTES de apagar o clube: depois dele ninguém mais listaria este clube e
    // os PDFs ficariam órfãos para sempre. Falhar aqui só avisa; não impede o
    // expurgo (que é obrigação legal).
    const contratos = await removeClubContractFiles(admin.storage, club.id);
    arquivosContrato += contratos.removed;
    if (contratos.error) {
      console.error(`[retencao] contratos de ${club.name}:`, contratos.error);
      falhou({ etapa: "contratos", clube: club.name, mensagem: contratos.error }, club.id);
    }

    const { error: delError } = await admin.from("clubs").delete().eq("id", club.id);
    if (delError) {
      console.error(`[retencao] falha ao apagar ${club.name}:`, delError.message);
      falhou(
        { etapa: "clube", clube: club.name, mensagem: `falha ao apagar o clube: ${delError.message}` },
        club.id,
      );
      continue;
    }
    apagados.push(club.name);
  }

  // Retenção da telemetria (30 dias). Antes da demo, que é demorada e pode
  // estourar o tempo da função: a limpeza é barata e não deve depender dela.
  // A função platform_prune_telemetry ainda não foi aplicada em produção;
  // ausente = "pendente", que NÃO deixa o cron vermelho (decisão do dono).
  const retencao = await pruneTelemetry(admin);
  if (retencao.status === "falhou") {
    falhou({ etapa: "retencao", mensagem: `retenção da telemetria falhou: ${retencao.message}` });
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
    falhou({ etapa: "demo", mensagem: `restauração da demo falhou: ${(e as Error).message}` });
  }

  return {
    value: {
      status: 200,
      body: {
        ok: falhas.length === 0,
        retencaoDias: settings.retentionDays,
        apagados,
        falhas: falhas.slice(0, 50),
        retencao: retencao.status,
        demo: { slug: DEMO_SLUG, resultado: demo },
      },
    },
    ok: falhas.length === 0,
    // Só números e estados: nada de nome de clube nem dado pessoal.
    summary: {
      retencaoDias: settings.retentionDays,
      clubesVencidos: vencidos?.length ?? 0,
      apagados: apagados.length,
      arquivosContrato,
      retencao: retencao.status,
      ...(retencao.removed ? { telemetriaRemovida: retencao.removed } : {}),
      demo: demo.startsWith("falhou") ? "falhou" : "ok",
    },
    failures: eventos,
  };
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Registra a execução em cron_runs (tela /admin/saude) sem alterar a resposta.
  const { status, body } = await withCronRun("club-retention", executarRetencao);
  return NextResponse.json(body, { status });
}

export const GET = run;
export const POST = run;
