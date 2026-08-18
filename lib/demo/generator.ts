import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PLANNING_COLUMNS } from "@/lib/data/planningDefaults";

/**
 * Geração do clube de demonstração.
 *
 * Mora aqui, e não só num script, porque a restauração periódica roda de
 * dentro do app: no plano atual da Vercel só cabem dois agendamentos
 * diários, então isto é chamado pelo cron de manutenção em vez de ganhar
 * um agendamento próprio.
 */
export const DEMO_SLUG = "demo";
export const DEMO_COACH_EMAIL = "demo@verticepf.com.br";
export const DEMO_ATHLETE_EMAIL = "atleta.demo@verticepf.com.br";
export const DEMO_PASSWORD = "Demo@2026!";

// ── gerador determinístico: mesma semente, mesmo elenco ────────────────
let semente = 20260813;
function rnd() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
}
const escolhe = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const inteiro = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const NOMES_M = ["Arthur","Miguel","Gael","Théo","Heitor","Davi","Bernardo","Gabriel","Samuel","Anthony","Benício","Lorenzo","Matheus","Rafael","Enzo","Pedro","Nicolas","João","Lucas","Guilherme","Vicente","Isaac","Benjamin","Henrique","Caio","Murilo","Otávio","Felipe","Bryan","Emanuel","Danilo","Ryan","Yuri","Kauã","Léo"];
const NOMES_F = ["Helena","Alice","Laura","Manuela","Sophia","Isabella","Heloísa","Valentina","Cecília","Eloá","Maitê","Lívia","Antonella","Beatriz","Júlia","Rafaela","Marina","Clara","Yasmin","Bruna"];
const SOBRENOMES = ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Ferreira","Almeida","Nascimento","Rodrigues","Carvalho","Gomes","Martins","Araújo","Barbosa","Ribeiro","Cardoso","Teixeira","Moraes","Dias","Cavalcanti","Monteiro","Duarte","Freitas"];

const POSICOES = ["Goleiro", "Fixo", "Ala", "Pivô"];
const SUBS = Array.from({ length: 12 }, (_, i) => `SUB${i + 6}`); // SUB6..SUB17

// `apelido` é o que entra no e-mail: usar a primeira área geraria o mesmo
// endereço para preparador e fisioterapeuta, que compartilham "fisico".
const PROFISSIONAIS = [
  { apelido: "preparador", titulo: "Preparador(a) físico(a)", areas: ["fisico"] },
  { apelido: "fisio", titulo: "Fisioterapeuta", areas: ["fisico", "saude"] },
  { apelido: "nutri", titulo: "Nutricionista", areas: ["nutricao"] },
];

const ADVERSARIOS = ["Falcões FC","Tigres do Norte","Leões da Serra","Real Sub Clube","Nova Geração FC","Estrela Azul FC","Atlético Litoral","Grêmio Municipal","Sport Base","União Futsal"];
const COMPETICOES = ["Copa Regional de Futsal","Liga Municipal de Base","Torneio de Verão","Campeonato Estadual Sub","Copa Integração"];

const FORCAS = ["Chute de média distância preciso","Boa leitura de jogo na saída de bola","Marcação individual agressiva","Rapidez na transição defensiva","Domínio orientado sob pressão","Liderança dentro de quadra","Excelente reposição de goleiro","Finalização de primeira","Boa visão de passe"];
const FRAQUEZAS = ["Perde a posição no recuo","Finalização com a perna não dominante","Comunicação baixa na marcação","Cansa no segundo tempo","Precipita o desarme","Domínio falha em bola alta","Demora a se reposicionar após perda"];
const OPORTUNIDADES = ["Pode assumir a cobrança de faltas","Encaixa bem como pivô fixo","Perfil para capitania na categoria","Tem espaço para jogar no sub acima","Pode virar referência na saída de bola"];
const AMEACAS = ["Histórico de dor no tornozelo","Frequência irregular nos treinos","Sobrecarga por jogar em dois times","Crescimento rápido exigindo controle de carga","Baixa adesão às orientações de dieta"];

const EXERCICIOS = [
  ["Agachamento com salto", "Força explosiva de membros inferiores", "Físico"],
  ["Prancha isométrica 3×40s", "Estabilidade de core", "Físico"],
  ["Escada de agilidade", "Coordenação e troca rápida de apoio", "Físico"],
  ["Finalização de primeira em movimento", "20 repetições cada perna", "Técnico"],
  ["Domínio orientado sob pressão", "Com marcador nas costas", "Técnico"],
  ["Passe de trivela em dupla", "Precisão a 8 metros", "Técnico"],
  ["Saída de goleiro com os pés", "Reposição rápida sob pressão", "Técnico"],
  ["Corrida intervalada 6×200m", "Capacidade aeróbica", "Físico"],
  ["Mobilidade de quadril", "Prevenção de lesão", "Preventivo"],
];

const NOTAS_MENTAIS = [
  ["Conversa pós-jogo", "Sentiu-se pressionado na cobrança de pênalti, mas assumiu a responsabilidade."],
  ["Retorno de lesão", "Ansioso para voltar; combinamos progressão gradual de carga."],
  ["Liderança", "Assumiu a conversa no vestiário no intervalo. Evolução clara de postura."],
  ["Concentração", "Oscilou no segundo tempo. Trabalhar rotina pré-jogo."],
  ["Confiança", "Voltou a pedir a bola em situações difíceis."],
  ["Frustração", "Reagiu mal à substituição. Conversado individualmente."],
];

const DESAFIOS = [
  ["100 embaixadinhas sem deixar cair", "Grave em vídeo e poste no Instagram marcando o clube.", "Bronze", 10],
  ["Semana perfeita de check-in", "Faça check-in todos os dias da semana.", "Bronze", 15],
  ["10 finalizações no ângulo", "Da marca do pênalti, sem goleiro.", "Prata", 25],
  ["Treino extra de força por 3 semanas", "Registre cada sessão no app.", "Prata", 30],
  ["Gol de bicicleta em jogo oficial", "Vale em qualquer competição do clube.", "Ouro", 60],
  ["Assistência decisiva na final", "Na final de qualquer campeonato.", "Ouro", 50],
];

const CATEGORIAS_DESPESA = [
  ["Aluguel de quadra", false], ["Material esportivo", false], ["Arbitragem", false],
  ["Transporte", false], ["Comissão técnica", true], ["Fisioterapia", true],
  ["Nutrição", true], ["Marketing", false],
];

const LESOES = [
  ["Tornozelo", "Entorse / Ligamento", "Leve (grau 1)"],
  ["Coxa (posterior)", "Estiramento muscular", "Moderada (grau 2)"],
  ["Joelho", "Contusão", "Leve (grau 1)"],
  ["Panturrilha", "Estiramento muscular", "Leve (grau 1)"],
  ["Virilha / Adutores", "Estiramento muscular", "Moderada (grau 2)"],
  ["Ombro", "Contusão", "Leve (grau 1)"],
];

const FOCOS_TREINO = ["Finalização","Saída de bola","Marcação por zona","Transição ofensiva","Bola parada","Condicionamento","Fundamentos de goleiro","Jogo posicional"];

function nomeCompleto(sexo: string) {
  const base = sexo === "F" ? escolhe(NOMES_F) : escolhe(NOMES_M);
  return `${base} ${escolhe(SOBRENOMES)}`;
}

/** SUB12 em 2026 = nascidos por volta de 2014. */
function nascimentoPara(sub: string) {
  const idade = Number(sub.replace("SUB", ""));
  const ano = 2026 - idade + inteiro(0, 1);
  return `${ano}-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`;
}

function fisicoPara(sub: string) {
  const idade = Number(sub.replace("SUB", ""));
  const altura = Math.round(80 + idade * 5.2 + inteiro(-6, 6));
  const peso = Math.round((altura / 100) ** 2 * inteiro(155, 205)) / 10;
  return { height_cm: altura, weight_kg: peso, bmi: Math.round((peso / (altura / 100) ** 2) * 10) / 10 };
}

const hoje = new Date("2026-08-13T12:00:00Z");
const dia = (offset: number) => new Date(hoje.getTime() + offset * 86400000).toISOString().slice(0, 10);



type Admin = ReturnType<typeof createAdminClient>;

async function criarUsuario(admin: Admin, email: string, fullName: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`criar usuário ${email}: ${error?.message}`);
  return data.user.id;
}

/**
 * Ordem de exclusão: `profiles.club_id` é RESTRICT, então o clube não sai
 * enquanto houver perfil; e `athletes.created_by` também é RESTRICT, então
 * o perfil não sai enquanto houver atleta. Dados → perfis → contas → clube.
 */
export const TABELAS_DO_CLUBE = [
  "athlete_swot_items", "athlete_swot_cycles", "athlete_billing_subscriptions",
  "athlete_cancellation_requests", "athlete_charges", "athlete_club_transfers",
  "athlete_injuries", "athlete_score_snapshots", "athlete_staff_access", "audit_log",
  "athlete_planning_stage", "cash_movements", "challenge_submissions", "challenges", "checkins",
  "club_asaas_credentials", "daily_cash_closures", "data_requests", "diet_items",
  "exercise_videos", "exercises", "expenses", "expense_categories", "game_events",
  "game_lineups", "game_reports", "games", "competitions", "invite_links", "media_items",
  "meetings", "mental_notes", "plays", "sub_staff_assignments", "partner_club_categories",
  "partner_clubs", "asaas_security_events", "planning_columns", "athletes",
] as const;

export async function apagarClube(admin: Admin, clubId: string) {
  const { data: perfis } = await admin.from("profiles").select("id").eq("club_id", clubId);
  await admin.from("clubs").update({ owner_profile_id: null }).eq("id", clubId);
  for (const tabela of TABELAS_DO_CLUBE) {
    await admin.from(tabela).delete().eq("club_id", clubId);
  }
  for (const p of perfis ?? []) {
    await admin.from("profiles").delete().eq("id", p.id);
    await admin.auth.admin.deleteUser(p.id).catch(() => {});
  }
  await admin.from("clubs").delete().eq("id", clubId);
}

async function insertMany<T>(admin: Admin, tabela: string, linhas: T[], chunk = 400) {
  const out: { id: string; [k: string]: unknown }[] = [];
  for (let i = 0; i < linhas.length; i += chunk) {
    const { data, error } = await admin
      .from(tabela)
      .insert(linhas.slice(i, i + chunk) as never)
      .select();
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as { id: string }[]));
  }
  return out;
}

export async function seedDemoClub(): Promise<{ clubId: string; atletas: number; profissionais: number }> {
  const admin = createAdminClient();
  semente = 20260813; // reinicia a semente: mesma demo a cada restauração

  const { data: existente } = await admin.from("clubs").select("id").eq("slug", DEMO_SLUG).maybeSingle();
  if (existente) await apagarClube(admin, existente.id);

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({
      name: "Vértice Demo",
      slug: DEMO_SLUG,
      status: "ativo",
      is_demo: true,
      courtesy_until: "2030-12-31T23:59:59Z",
      courtesy_reason: "Ambiente de demonstração",
      max_athletes_override: 400,
    })
    .select("id")
    .single();
  if (clubError || !club) throw new Error(`clube: ${clubError?.message}`);

  const coachId = await criarUsuario(admin, DEMO_COACH_EMAIL, "Direção Vértice Demo");
  await admin.from("profiles").insert({ id: coachId, club_id: club.id, role: "coach", full_name: "Direção Vértice Demo" });
  await admin.from("clubs").update({ owner_profile_id: coachId }).eq("id", club.id);

  const colunasPlanejamento = (await insertMany(
    admin,
    "planning_columns",
    DEFAULT_PLANNING_COLUMNS.map((c) => ({ club_id: club.id, ...c })),
  )) as unknown as { id: string; position: number }[];
  colunasPlanejamento.sort((a, b) => a.position - b.position);

  const { data: timeCasa } = await admin
    .from("partner_clubs")
    .insert({ club_id: club.id, name: "Vértice Demo", is_managed: true, color_1: "#111111", color_2: "#FFD600", color_3: "#FFFFFF" })
    .select("id")
    .single();
  await insertMany(admin, "partner_club_categories", SUBS.map((s) => ({ club_id: club.id, partner_club_id: timeCasa!.id, name: s })));
  await insertMany(admin, "partner_clubs", ADVERSARIOS.map((nome) => ({ club_id: club.id, name: nome, is_managed: false })));

  const linhasAtletas: Record<string, unknown>[] = [];
  for (const sub of SUBS) {
    for (let i = 0; i < 15; i++) {
      const sexo = rnd() < 0.22 ? "F" : "M";
      const fixo = sub === "SUB12" && i === 0;
      const nome = fixo ? "Matheus Vinicius" : nomeCompleto(sexo);
      const fis = fisicoPara(sub);
      const posicoes = rnd() < 0.18 ? ["Goleiro"] : [escolhe(POSICOES.slice(1))].concat(rnd() < 0.3 ? [escolhe(POSICOES.slice(1))] : []);
      linhasAtletas.push({
        club_id: club.id, created_by: coachId, full_name: nome, category: sub, team: "Vértice Demo",
        sex: fixo ? "M" : sexo, position: [...new Set(posicoes)], birth_date: nascimentoPara(sub),
        guardian_name: `${escolhe(NOMES_F)} ${nome.split(" ")[1]}`,
        guardian_phone: `(83) 9${inteiro(8000, 9999)}-${inteiro(1000, 9999)}`,
        joined_at: dia(-inteiro(30, 700)),
        photo_color: escolhe(["#111111", "#D72B2B", "#E6C000", "#1A4D8F", "#1E6F4B"]),
        ...fis, jersey_num: i + 1,
      });
    }
  }
  const atletas = (await insertMany(admin, "athletes", linhasAtletas)) as unknown as { id: string; category: string; full_name: string }[];
  const porSub = new Map<string, { id: string; full_name: string }[]>();
  for (const a of atletas) {
    if (!porSub.has(a.category)) porSub.set(a.category, []);
    porSub.get(a.category)!.push(a);
  }

  // Curva em sino: a maioria em desenvolvimento, poucos recém-diagnosticados
  // ou já consolidados — pra o board de planejamento não nascer com tudo
  // amontoado numa coluna só.
  const PESOS_ETAPA = [0.15, 0.25, 0.3, 0.2, 0.1];
  function colunaAleatoria() {
    let r = rnd();
    for (let i = 0; i < PESOS_ETAPA.length; i++) {
      r -= PESOS_ETAPA[i];
      if (r <= 0) return colunasPlanejamento[i];
    }
    return colunasPlanejamento[colunasPlanejamento.length - 1];
  }
  await insertMany(
    admin,
    "athlete_planning_stage",
    atletas.map((a) => ({
      club_id: club.id,
      athlete_id: a.id,
      column_id: colunaAleatoria().id,
      moved_at: new Date(hoje.getTime() - inteiro(2, 60) * 86400000).toISOString(),
    })),
  );

  // Acesso do atleta: sem isso a demo mostra só o lado do treinador, e a
  // área do atleta — que é metade do produto — fica invisível.
  const matheus = atletas.find((a) => a.full_name === "Matheus Vinicius" && a.category === "SUB12");
  if (matheus) {
    const atletaId = await criarUsuario(admin, DEMO_ATHLETE_EMAIL, "Matheus Vinicius");
    await admin.from("profiles").insert({
      id: atletaId, club_id: club.id, role: "athlete", full_name: "Matheus Vinicius", athlete_id: matheus.id,
    });
  }

  const acessos: Record<string, unknown>[] = [];
  const perfisStaff: Record<string, unknown>[] = [];
  for (const sub of SUBS) {
    for (const prof of PROFISSIONAIS) {
      const nome = nomeCompleto(rnd() < 0.5 ? "F" : "M");
      const id = await criarUsuario(admin, `demo.${prof.apelido}.${sub.toLowerCase()}@verticepf.com.br`, nome);
      perfisStaff.push({ id, club_id: club.id, role: "staff", full_name: nome, title: `${prof.titulo} — ${sub}`, staff_areas: prof.areas });
      for (const a of porSub.get(sub)!) {
        acessos.push({ club_id: club.id, athlete_id: a.id, staff_profile_id: id, granted_by: coachId, access_level: "manage" });
      }
    }
  }
  await insertMany(admin, "profiles", perfisStaff);
  await insertMany(admin, "athlete_staff_access", acessos);

  const competicoes = await insertMany(admin, "competitions", COMPETICOES.map((name) => ({ club_id: club.id, name })));
  const jogos: Record<string, unknown>[] = [];
  competicoes.forEach((comp, ci) => {
    ADVERSARIOS.forEach((adv, ai) => {
      const offset = -120 + ci * 24 + ai * 2;
      const passado = offset < 0;
      jogos.push({
        club_id: club.id, competition_id: comp.id, created_by: coachId, opponent: adv,
        scheduled_date: dia(offset), scheduled_time: escolhe(["09:00", "10:30", "15:00", "16:30", "19:00"]),
        location: escolhe(["Ginásio Municipal", "Quadra Vértice", "Ginásio do Adversário"]),
        target_type: "team", target_team: "Vértice Demo", target_category: escolhe(SUBS),
        our_score: passado ? inteiro(0, 6) : null, opponent_score: passado ? inteiro(0, 5) : null,
        lineup_published_at: passado ? new Date(hoje.getTime() + offset * 86400000).toISOString() : null,
      });
    });
  });
  const jogosCriados = (await insertMany(admin, "games", jogos)) as unknown as {
    id: string; target_category: string; our_score: number | null;
  }[];

  const escalacoes: Record<string, unknown>[] = [];
  const eventos: Record<string, unknown>[] = [];
  for (const jogo of jogosCriados) {
    const convocados = (porSub.get(jogo.target_category) ?? []).slice(0, 10);
    convocados.forEach((a, idx) => {
      escalacoes.push({ club_id: club.id, game_id: jogo.id, athlete_id: a.id, status: idx < 5 ? "Titular" : idx < 8 ? "Reserva" : "Convocado" });
    });
    if (jogo.our_score != null && convocados.length) {
      for (let g = 0; g < jogo.our_score; g++) {
        const autor = escolhe(convocados.slice(0, 8));
        eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: autor.id, event_type: "Gol", goal_type: escolhe(["Normal", "Pênalti", "Fora da área"]), minute: inteiro(1, 40), created_by: coachId });
      }
      for (let d = 0; d < inteiro(2, 6); d++) {
        eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: escolhe(convocados).id, event_type: escolhe(["Desarme", "Interceptação", "Finalização certa", "Defesa", "Passe certo"]), goal_type: null, minute: inteiro(1, 40), created_by: coachId });
      }
    }
  }
  await insertMany(admin, "game_lineups", escalacoes);
  await insertMany(admin, "game_events", eventos);

  const treinos: Record<string, unknown>[] = [];
  for (const sub of SUBS) {
    for (let t = 0; t < 6; t++) {
      const offset = -35 + t * 7;
      const batch = crypto.randomUUID();
      const foco = escolhe(FOCOS_TREINO);
      for (const a of porSub.get(sub)!) {
        treinos.push({
          athlete_id: a.id, club_id: club.id, created_by: coachId,
          title: `Treino técnico ${sub} — ${foco}`, meeting_type: "Presencial",
          scheduled_date: dia(offset), scheduled_time: "15:30",
          status: offset < 0 ? "Concluído" : "Agendado", purpose: "Treino", focus_tag: foco,
          batch_id: batch, athlete_confirmed: offset < 0 ? rnd() < 0.85 : rnd() < 0.5,
          notes: `Foco em ${foco.toLowerCase()}.`,
        });
      }
    }
  }
  await insertMany(admin, "meetings", treinos);

  const ciclos = (await insertMany(admin, "athlete_swot_cycles",
    atletas.map((a) => ({ club_id: club.id, athlete_id: a.id, cycle_number: 1, status: "Aberto", created_by: coachId })),
  )) as unknown as { id: string; athlete_id: string }[];

  const itens: Record<string, unknown>[] = [];
  for (const ciclo of ciclos) {
    const plano: [string, string[]][] = [
      ["Força", FORCAS], ["Força", FORCAS], ["Fraqueza", FRAQUEZAS], ["Fraqueza", FRAQUEZAS],
      ["Oportunidade", OPORTUNIDADES], ["Ameaça", AMEACAS],
    ];
    for (const [categoria, fonte] of plano) {
      const mt = categoria === "Fraqueza" ? inteiro(4, 10) : 0;
      const me = categoria === "Fraqueza" ? inteiro(1, 3) : 0;
      itens.push({
        cycle_id: ciclo.id, club_id: club.id, athlete_id: ciclo.athlete_id, category: categoria,
        author_role: rnd() < 0.75 ? "coach" : "athlete", description: escolhe(fonte),
        target_trainings: mt, target_meetings: me,
        trainings_done: mt ? inteiro(0, mt) : 0, meetings_done: me ? inteiro(0, me) : 0,
        status: "Aberto", created_by: coachId,
      });
    }
  }
  await insertMany(admin, "athlete_swot_items", itens);

  const checkins: Record<string, unknown>[] = [];
  for (const a of atletas) {
    for (let d = 1; d <= 14; d++) {
      if (rnd() > 0.55) continue;
      checkins.push({
        athlete_id: a.id, club_id: club.id, checkin_date: dia(-d),
        fatigue_level: inteiro(1, 5), training_done: rnd() < 0.82, diet_done: rnd() < 0.7,
        pain_notes: rnd() < 0.12 ? escolhe(["Leve dor no tornozelo", "Desconforto na coxa", "Joelho sensível após o treino"]) : null,
      });
    }
  }
  await insertMany(admin, "checkins", checkins);

  // ── financeiro ────────────────────────────────────────────────────────
  // Mensalidade por atleta nos últimos seis meses, com mistura realista de
  // pago, a vencer e atrasado. Sem isso o painel mostra R$ 0,00 em tudo e a
  // apresentação perde justamente a parte que fecha venda.
  const MENSALIDADE_POR_SUB: Record<string, number> = {
    SUB6: 12000, SUB7: 12000, SUB8: 13000, SUB9: 13000, SUB10: 15000, SUB11: 15000,
    SUB12: 18000, SUB13: 18000, SUB14: 20000, SUB15: 20000, SUB16: 22000, SUB17: 22000,
  };
  const cobrancas: Record<string, unknown>[] = [];
  const hojeData = new Date(hoje);
  for (const a of atletas) {
    const valor = MENSALIDADE_POR_SUB[a.category] ?? 15000;
    for (let m = 5; m >= 0; m--) {
      const ref = new Date(Date.UTC(hojeData.getUTCFullYear(), hojeData.getUTCMonth() - m, 10));
      const venc = ref.toISOString().slice(0, 10);
      const passado = ref < hojeData;
      // Inadimplência concentrada em poucos atletas, como na vida real:
      // um clube não tem 30% de devedores espalhados por igual.
      const caloteiro = rnd() < 0.12;
      const status = !passado ? "Pendente" : caloteiro && rnd() < 0.7 ? "Atrasado" : rnd() < 0.94 ? "Pago" : "Atrasado";
      cobrancas.push({
        club_id: club.id, athlete_id: a.id,
        description: `Mensalidade ${String(ref.getUTCMonth() + 1).padStart(2, "0")}/${ref.getUTCFullYear()}`,
        amount_cents: valor,
        competence_month: ref.getUTCMonth() + 1, competence_year: ref.getUTCFullYear(),
        due_date: venc, status,
        paid_at: status === "Pago" ? new Date(ref.getTime() - inteiro(0, 8) * 86400000).toISOString() : null,
        payment_method: status === "Pago" ? escolhe(["PIX", "Cartão", "Dinheiro", "Boleto"]) : null,
        discount_cents: rnd() < 0.06 ? 2000 : 0,
        created_by: coachId, notes: null,
      });
    }
  }
  await insertMany(admin, "athlete_charges", cobrancas);

  const categorias = (await insertMany(admin, "expense_categories",
    CATEGORIAS_DESPESA.map(([nome, prof]) => ({ club_id: club.id, name: nome, requires_professional: prof })),
  )) as unknown as { id: string; name: string }[];

  const despesas: Record<string, unknown>[] = [];
  for (let m = 5; m >= 0; m--) {
    const ref = new Date(Date.UTC(hojeData.getUTCFullYear(), hojeData.getUTCMonth() - m, 5));
    for (const cat of categorias) {
      const base = cat.name === "Aluguel de quadra" ? 320000 : cat.name === "Comissão técnica" ? 850000 : inteiro(30000, 180000);
      despesas.push({
        club_id: club.id, category_id: cat.id,
        description: `${cat.name} — ${String(ref.getUTCMonth() + 1).padStart(2, "0")}/${ref.getUTCFullYear()}`,
        amount_cents: base, due_date: ref.toISOString().slice(0, 10),
        status: ref < hojeData ? (rnd() < 0.92 ? "Pago" : "Atrasado") : "Pendente",
        paid_at: ref < hojeData && rnd() < 0.92 ? ref.toISOString() : null,
        payment_method: null, created_by: coachId, professional_id: null, notes: null,
      });
    }
  }
  await insertMany(admin, "expenses", despesas);

  // ── treinos prescritos, notas mentais e lesões ────────────────────────
  const exercicios: Record<string, unknown>[] = [];
  const notas: Record<string, unknown>[] = [];
  for (const a of atletas) {
    for (let e = 0; e < inteiro(4, 9); e++) {
      const [nome, desc, foco] = escolhe(EXERCICIOS);
      exercicios.push({
        athlete_id: a.id, club_id: club.id, prescribed_by: coachId, name: nome,
        description: desc, focus: foco, done: rnd() < 0.72,
        scheduled_date: dia(-inteiro(0, 30)), video_url: null, swot_item_id: null,
      });
    }
    if (rnd() < 0.45) {
      const [titulo, corpo] = escolhe(NOTAS_MENTAIS);
      notas.push({
        athlete_id: a.id, club_id: club.id, author_id: coachId, title: titulo, body: corpo,
        confidence_score: inteiro(4, 10), video_url: null, entry_date: dia(-inteiro(1, 60)), swot_item_id: null,
      });
    }
  }
  await insertMany(admin, "exercises", exercicios);
  await insertMany(admin, "mental_notes", notas);

  const lesoes: Record<string, unknown>[] = [];
  for (const a of atletas) {
    if (rnd() > 0.14) continue;
    const [regiao, tipo, gravidade] = escolhe(LESOES);
    const quando = dia(-inteiro(3, 90));
    const emTratamento = rnd() < 0.4;
    lesoes.push({
      club_id: club.id, athlete_id: a.id, source: "Avulso", body_region: regiao,
      injury_type: tipo, severity: gravidade, occurred_at: quando,
      description: "Relatado após o treino.",
      expected_return_date: emTratamento ? dia(inteiro(3, 25)) : null,
      status: emTratamento ? "Em tratamento" : "Recuperado",
      treatment_notes: emTratamento ? "Fisioterapia 3× por semana, carga progressiva." : "Alta liberada.",
      created_by: coachId,
    });
  }
  await insertMany(admin, "athlete_injuries", lesoes);

  // ── desafios ─────────────────────────────────────────────────────────
  const desafios = (await insertMany(admin, "challenges",
    DESAFIOS.map(([titulo, desc, tier, pontos]) => ({
      club_id: club.id, title: titulo, description: desc, tier, points: pontos,
      status: "Ativo", created_by: coachId, athlete_id: null, target_position: null,
    })),
  )) as unknown as { id: string; points: number }[];

  const envios: Record<string, unknown>[] = [];
  for (const a of atletas) {
    if (rnd() > 0.3) continue;
    const d = escolhe(desafios);
    const avaliado = rnd() < 0.7;
    const aprovado = avaliado && rnd() < 0.75;
    envios.push({
      club_id: club.id, challenge_id: d.id, athlete_id: a.id,
      instagram_url: "https://instagram.com/p/demo", notes: "Segue o vídeo do desafio!",
      status: avaliado ? (aprovado ? "Aprovado" : "Rejeitado") : "Pendente",
      points_awarded: aprovado ? d.points : null,
      reviewed_by: avaliado ? coachId : null,
      reviewed_at: avaliado ? new Date().toISOString() : null,
      review_notes: avaliado ? (aprovado ? "Boa execução!" : "Repita com o vídeo completo.") : null,
    });
  }
  await insertMany(admin, "challenge_submissions", envios);

  // ── histórico de score: dá curva ao gráfico de evolução ───────────────
  const snapshots: Record<string, unknown>[] = [];
  for (const a of atletas) {
    let base = inteiro(42, 68);
    for (let s = 5; s >= 0; s--) {
      base = Math.max(30, Math.min(95, base + inteiro(-3, 5)));
      snapshots.push({
        club_id: club.id, athlete_id: a.id, overall: base,
        attack: Math.max(30, Math.min(99, base + inteiro(-12, 12))),
        defense: Math.max(30, Math.min(99, base + inteiro(-12, 12))),
        discipline: inteiro(75, 99), physical: Math.max(30, Math.min(99, base + inteiro(-10, 10))),
        mental: Math.max(30, Math.min(99, base + inteiro(-10, 10))),
        commitment: Math.max(30, Math.min(99, base + inteiro(-8, 12))),
        development: Math.max(30, Math.min(99, base + inteiro(-8, 8))),
        computed_at: new Date(hoje.getTime() - s * 14 * 86400000).toISOString(),
        acknowledged: true,
      });
    }
  }
  await insertMany(admin, "athlete_score_snapshots", snapshots);

  return { clubId: club.id, atletas: atletas.length, profissionais: perfisStaff.length };
}
