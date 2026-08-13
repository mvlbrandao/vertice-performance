// Monta o clube de demonstração do zero: SUB6 a SUB17, elenco completo,
// comissão técnica por categoria, campeonatos, treinos, SWOT e check-ins.
//
// Existe como script, e não como dados inseridos à mão, porque a demo
// precisa ser reconstruível: é ela que o visitante mexe à vontade, e a
// restauração periódica joga tudo fora e roda isto de novo.
//
// Uso:
//   node scripts/seed-demo-club.mjs           # cria (falha se já existir)
//   node scripts/seed-demo-club.mjs --reset   # apaga e recria
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const SLUG = "demo";
const COACH_EMAIL = "demo@verticepf.com.br";
const COACH_PASSWORD = "Demo@2026!";

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

/** Insere em blocos: um POST com milhares de linhas estoura o limite. */
async function insertMany(table, rows, chunk = 400) {
  const out = [];
  for (let i = 0; i < rows.length; i += chunk) {
    out.push(...(await rest(table, { method: "POST", body: JSON.stringify(rows.slice(i, i + chunk)) })));
  }
  return out;
}

// ── gerador determinístico: mesma semente, mesmo elenco ────────────────
let semente = 20260813;
function rnd() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
}
const escolhe = (arr) => arr[Math.floor(rnd() * arr.length)];
const inteiro = (min, max) => min + Math.floor(rnd() * (max - min + 1));

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

function nomeCompleto(sexo) {
  const base = sexo === "F" ? escolhe(NOMES_F) : escolhe(NOMES_M);
  return `${base} ${escolhe(SOBRENOMES)}`;
}

/** SUB12 em 2026 = nascidos por volta de 2014. */
function nascimentoPara(sub) {
  const idade = Number(sub.replace("SUB", ""));
  const ano = 2026 - idade + inteiro(0, 1);
  return `${ano}-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`;
}

function fisicoPara(sub) {
  const idade = Number(sub.replace("SUB", ""));
  const altura = Math.round(80 + idade * 5.2 + inteiro(-6, 6));
  const peso = Math.round((altura / 100) ** 2 * inteiro(155, 205)) / 10;
  return { height_cm: altura, weight_kg: peso, bmi: Math.round((peso / (altura / 100) ** 2) * 10) / 10 };
}

const hoje = new Date("2026-08-13T12:00:00Z");
const dia = (offset) => new Date(hoje.getTime() + offset * 86400000).toISOString().slice(0, 10);

/**
 * Ordem de exclusão importa e não é a óbvia. `profiles.club_id` é RESTRICT,
 * então o clube não sai enquanto houver perfil; e `athletes.created_by`
 * também é RESTRICT, então o perfil não sai enquanto houver atleta. Apagar
 * "o clube e deixar o cascade resolver" trava nessa dupla.
 *
 * A ordem que funciona é: dados do clube → perfis → contas de acesso →
 * clube. A lista abaixo cobre tudo que tem club_id; a ordem interna não
 * importa porque o que depende de atleta cai por cascade quando o atleta cai.
 */
const TABELAS_DO_CLUBE = [
  "athlete_swot_items","athlete_swot_cycles","athlete_billing_subscriptions","athlete_cancellation_requests",
  "athlete_charges","athlete_club_transfers","athlete_injuries","athlete_score_snapshots","athlete_staff_access",
  "audit_log","cash_movements","challenge_submissions","challenges","checkins","club_asaas_credentials",
  "daily_cash_closures","data_requests","diet_items","exercise_videos","exercises","expenses","expense_categories",
  "game_events","game_lineups","game_reports","games","competitions","invite_links","media_items","meetings",
  "mental_notes","plays","sub_staff_assignments","partner_club_categories","partner_clubs",
  "asaas_security_events","athletes",
];

async function apagarDemo() {
  const [club] = await rest(`clubs?slug=eq.${SLUG}&select=id`);
  if (!club) return false;

  const perfis = await rest(`profiles?club_id=eq.${club.id}&select=id`);
  await rest(`clubs?id=eq.${club.id}`, { method: "PATCH", body: JSON.stringify({ owner_profile_id: null }) });

  for (const tabela of TABELAS_DO_CLUBE) {
    await fetch(`${BASE}/rest/v1/${tabela}?club_id=eq.${club.id}`, { method: "DELETE", headers: H });
  }
  for (const p of perfis) {
    await rest(`profiles?id=eq.${p.id}`, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${p.id}`, { method: "DELETE", headers: H });
  }
  await rest(`clubs?id=eq.${club.id}`, { method: "DELETE" });
  return true;
}

async function criarUsuario(email, password, fullName) {
  const res = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const body = await res.json();
  if (!body.id) throw new Error(`criar usuário ${email}: ${JSON.stringify(body)}`);
  return body.id;
}

async function main() {
  if (process.argv.includes("--reset")) {
    const apagou = await apagarDemo();
    console.log(apagou ? "demo anterior removida" : "nenhuma demo anterior");
  }

  const [existente] = await rest(`clubs?slug=eq.${SLUG}&select=id`);
  if (existente) throw new Error("Clube demo já existe. Use --reset para recriar.");

  // ── clube ────────────────────────────────────────────────────────────
  const [club] = await rest("clubs", {
    method: "POST",
    body: JSON.stringify({
      name: "Vértice Demo",
      slug: SLUG,
      status: "ativo",
      is_demo: true,
      // Cortesia longa e cota folgada: a demo não pode bloquear no meio de
      // uma apresentação nem esbarrar no limite de atletas do plano.
      courtesy_until: "2030-12-31T23:59:59Z",
      courtesy_reason: "Ambiente de demonstração",
      max_athletes_override: 400,
    }),
  });
  console.log("clube:", club.id);

  const coachId = await criarUsuario(COACH_EMAIL, COACH_PASSWORD, "Direção Vértice Demo");
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({ id: coachId, club_id: club.id, role: "coach", full_name: "Direção Vértice Demo" }),
  });
  await rest(`clubs?id=eq.${club.id}`, { method: "PATCH", body: JSON.stringify({ owner_profile_id: coachId }) });

  // ── time próprio + adversários ───────────────────────────────────────
  const [timeCasa] = await rest("partner_clubs", {
    method: "POST",
    body: JSON.stringify({ club_id: club.id, name: "Vértice Demo", is_managed: true, color_1: "#111111", color_2: "#FFD600", color_3: "#FFFFFF" }),
  });
  await insertMany("partner_club_categories", SUBS.map((s) => ({ club_id: club.id, partner_club_id: timeCasa.id, name: s })));
  await insertMany("partner_clubs", ADVERSARIOS.map((nome) => ({ club_id: club.id, name: nome, is_managed: false })));
  console.log("times:", 1 + ADVERSARIOS.length);

  // ── atletas: 15 por sub ──────────────────────────────────────────────
  const atletasPorSub = new Map();
  const linhasAtletas = [];
  for (const sub of SUBS) {
    for (let i = 0; i < 15; i++) {
      const sexo = rnd() < 0.22 ? "F" : "M";
      // O usuário pediu esse nome fixo no SUB12 — é o atleta que ele usa
      // para demonstrar a área do atleta.
      const nome = sub === "SUB12" && i === 0 ? "Matheus Vinicius" : nomeCompleto(sexo);
      const fis = fisicoPara(sub);
      const posicoes = rnd() < 0.18 ? ["Goleiro"] : [escolhe(POSICOES.slice(1))].concat(rnd() < 0.3 ? [escolhe(POSICOES.slice(1))] : []);
      linhasAtletas.push({
        club_id: club.id,
        created_by: coachId,
        full_name: nome,
        category: sub,
        team: "Vértice Demo",
        sex: sub === "SUB12" && i === 0 ? "M" : sexo,
        position: [...new Set(posicoes)],
        birth_date: nascimentoPara(sub),
        guardian_name: `${escolhe(NOMES_F)} ${nome.split(" ")[1]}`,
        guardian_phone: `(83) 9${inteiro(8000, 9999)}-${inteiro(1000, 9999)}`,
        joined_at: dia(-inteiro(30, 700)),
        photo_color: escolhe(["#111111", "#D72B2B", "#E6C000", "#1A4D8F", "#1E6F4B"]),
        ...fis,
        jersey_num: i + 1,
      });
    }
  }
  const atletas = await insertMany("athletes", linhasAtletas);
  for (const a of atletas) {
    if (!atletasPorSub.has(a.category)) atletasPorSub.set(a.category, []);
    atletasPorSub.get(a.category).push(a);
  }
  console.log("atletas:", atletas.length);

  // ── comissão técnica: 3 por sub, com acesso só aos atletas dela ──────
  const acessos = [];
  const perfisStaff = [];
  for (const sub of SUBS) {
    for (const prof of PROFISSIONAIS) {
      const nome = nomeCompleto(rnd() < 0.5 ? "F" : "M");
      const email = `demo.${prof.apelido}.${sub.toLowerCase()}@verticepf.com.br`;
      const id = await criarUsuario(email, "Demo@2026!", nome);
      perfisStaff.push({ id, club_id: club.id, role: "staff", full_name: nome, title: `${prof.titulo} — ${sub}`, staff_areas: prof.areas });
      for (const a of atletasPorSub.get(sub)) {
        acessos.push({ club_id: club.id, athlete_id: a.id, staff_profile_id: id, granted_by: coachId, access_level: "manage" });
      }
    }
    process.stdout.write(`  comissão ${sub}\r`);
  }
  await insertMany("profiles", perfisStaff);
  await insertMany("athlete_staff_access", acessos);
  console.log(`comissão técnica: ${perfisStaff.length} profissionais, ${acessos.length} acessos`);

  // ── campeonatos: 5, cada um contra os 10 times ───────────────────────
  const competicoes = await insertMany("competitions", COMPETICOES.map((name) => ({ club_id: club.id, name })));
  const jogos = [];
  competicoes.forEach((comp, ci) => {
    ADVERSARIOS.forEach((adv, ai) => {
      const offset = -120 + ci * 24 + ai * 2;
      const passado = offset < 0;
      jogos.push({
        club_id: club.id,
        competition_id: comp.id,
        created_by: coachId,
        opponent: adv,
        scheduled_date: dia(offset),
        scheduled_time: escolhe(["09:00", "10:30", "15:00", "16:30", "19:00"]),
        location: escolhe(["Ginásio Municipal", "Quadra Vértice", "Ginásio do Adversário"]),
        target_type: "team",
        target_team: "Vértice Demo",
        target_category: escolhe(SUBS),
        our_score: passado ? inteiro(0, 6) : null,
        opponent_score: passado ? inteiro(0, 5) : null,
        lineup_published_at: passado ? new Date(hoje.getTime() + offset * 86400000).toISOString() : null,
      });
    });
  });
  const jogosCriados = await insertMany("games", jogos);
  console.log(`campeonatos: ${competicoes.length}, jogos: ${jogosCriados.length}`);

  // ── escalações e eventos dos jogos já disputados ─────────────────────
  const escalacoes = [];
  const eventos = [];
  for (const jogo of jogosCriados) {
    const elenco = atletasPorSub.get(jogo.target_category) ?? [];
    const convocados = elenco.slice(0, 10);
    convocados.forEach((a, idx) => {
      escalacoes.push({
        club_id: club.id,
        game_id: jogo.id,
        athlete_id: a.id,
        status: idx < 5 ? "Titular" : idx < 8 ? "Reserva" : "Convocado",
      });
    });
    if (jogo.our_score != null) {
      for (let g = 0; g < jogo.our_score; g++) {
        const autor = escolhe(convocados.slice(0, 8));
        eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: autor.id, event_type: "Gol", goal_type: escolhe(["Normal", "Pênalti", "Fora da área"]), minute: inteiro(1, 40), created_by: coachId });
        if (rnd() < 0.6) {
          const assistente = escolhe(convocados.slice(0, 8));
          if (assistente.id !== autor.id) eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: assistente.id, event_type: "Assistência", goal_type: null, minute: inteiro(1, 40), created_by: coachId });
        }
      }
      for (let d = 0; d < inteiro(2, 6); d++) {
        eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: escolhe(convocados).id, event_type: escolhe(["Desarme", "Interceptação", "Finalização certa", "Defesa", "Passe certo"]), goal_type: null, minute: inteiro(1, 40), created_by: coachId });
      }
      if (rnd() < 0.3) eventos.push({ club_id: club.id, game_id: jogo.id, athlete_id: escolhe(convocados).id, event_type: "Cartão amarelo", goal_type: null, minute: inteiro(10, 40), created_by: coachId });
    }
  }
  await insertMany("game_lineups", escalacoes);
  await insertMany("game_events", eventos);
  console.log(`escalações: ${escalacoes.length}, eventos: ${eventos.length}`);

  // ── treinos: 6 por sub, cada um como encontro de todo o elenco ───────
  const treinos = [];
  for (const sub of SUBS) {
    const elenco = atletasPorSub.get(sub);
    for (let t = 0; t < 6; t++) {
      const offset = -35 + t * 7;
      const batch = crypto.randomUUID();
      const foco = escolhe(FOCOS_TREINO);
      for (const a of elenco) {
        treinos.push({
          athlete_id: a.id,
          club_id: club.id,
          created_by: coachId,
          title: `Treino técnico ${sub} — ${foco}`,
          meeting_type: "Presencial",
          scheduled_date: dia(offset),
          scheduled_time: "15:30",
          status: offset < 0 ? "Concluído" : "Agendado",
          purpose: "Treino",
          focus_tag: foco,
          batch_id: batch,
          athlete_confirmed: offset < 0 ? rnd() < 0.85 : rnd() < 0.5,
          notes: `Foco em ${foco.toLowerCase()}.`,
        });
      }
    }
  }
  await insertMany("meetings", treinos);
  console.log("treinos lançados:", treinos.length);

  // ── SWOT: um ciclo aberto por atleta, com itens nas quatro categorias ─
  const ciclos = await insertMany(
    "athlete_swot_cycles",
    atletas.map((a) => ({ club_id: club.id, athlete_id: a.id, cycle_number: 1, status: "Aberto", created_by: coachId })),
  );
  const itens = [];
  for (const ciclo of ciclos) {
    const plano = [
      ["Força", FORCAS], ["Força", FORCAS],
      ["Fraqueza", FRAQUEZAS], ["Fraqueza", FRAQUEZAS],
      ["Oportunidade", OPORTUNIDADES],
      ["Ameaça", AMEACAS],
    ];
    for (const [categoria, fonte] of plano) {
      const metaTreinos = categoria === "Fraqueza" ? inteiro(4, 10) : 0;
      const metaEncontros = categoria === "Fraqueza" ? inteiro(1, 3) : 0;
      itens.push({
        cycle_id: ciclo.id,
        club_id: club.id,
        athlete_id: ciclo.athlete_id,
        category: categoria,
        author_role: rnd() < 0.75 ? "coach" : "athlete",
        description: escolhe(fonte),
        target_trainings: metaTreinos,
        target_meetings: metaEncontros,
        trainings_done: metaTreinos ? inteiro(0, metaTreinos) : 0,
        meetings_done: metaEncontros ? inteiro(0, metaEncontros) : 0,
        status: "Aberto",
        created_by: coachId,
      });
    }
  }
  await insertMany("athlete_swot_items", itens);
  console.log(`SWOT: ${ciclos.length} ciclos, ${itens.length} itens`);

  // ── check-ins dos últimos 14 dias ────────────────────────────────────
  const checkins = [];
  for (const a of atletas) {
    for (let d = 1; d <= 14; d++) {
      if (rnd() > 0.55) continue;
      checkins.push({
        athlete_id: a.id,
        club_id: club.id,
        checkin_date: dia(-d),
        fatigue_level: inteiro(1, 5),
        training_done: rnd() < 0.82,
        diet_done: rnd() < 0.7,
        pain_notes: rnd() < 0.12 ? escolhe(["Leve dor no tornozelo", "Desconforto na coxa", "Joelho sensível após o treino"]) : null,
      });
    }
  }
  await insertMany("checkins", checkins);
  console.log("check-ins:", checkins.length);

  console.log("\n✅ demo pronta");
  console.log(`   link: /c/${SLUG}`);
  console.log(`   acesso: ${COACH_EMAIL} / ${COACH_PASSWORD}`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
