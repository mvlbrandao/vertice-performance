import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
  "cash_movements", "challenge_submissions", "challenges", "checkins",
  "club_asaas_credentials", "daily_cash_closures", "data_requests", "diet_items",
  "exercise_videos", "exercises", "expenses", "expense_categories", "game_events",
  "game_lineups", "game_reports", "games", "competitions", "invite_links", "media_items",
  "meetings", "mental_notes", "plays", "sub_staff_assignments", "partner_club_categories",
  "partner_clubs", "asaas_security_events", "athletes",
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

  return { clubId: club.id, atletas: atletas.length, profissionais: perfisStaff.length };
}
