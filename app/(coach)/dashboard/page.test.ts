import { describe, it, expect, vi, afterEach } from "vitest";

const estado = vi.hoisted(() => ({
  cliente: null as unknown,
  chamadasDeAssinatura: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({
    userId: "user-1",
    email: null,
    clubId: "club-1",
    role: "coach",
    fullName: "Treinadora Teste",
    athleteId: null,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => estado.cliente }));
vi.mock("@/lib/storage/resolveSignedUrl", () => ({
  resolveSignedUrls: async (_bucket: string, paths: (string | null)[]) => {
    estado.chamadasDeAssinatura++;
    return new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://assinada.test/${p}`]));
  },
}));

import DashboardPage from "./page";
import { criarSupabaseFalso, idFalso, type Linha } from "@/lib/testing/supabaseFalso";
import { hojeISO, somaDias } from "@/lib/utils/date";

/** Clube com 8 atletas ativos (o painel mostra 6), uma equipe gerida e dois jogos dela. */
function montarClube(): Record<string, Linha[]> {
  const hoje = hojeISO();
  const athletes: Linha[] = [];
  const game_events: Linha[] = [];
  for (let i = 1; i <= 8; i++) {
    const id = idFalso("a7e1e700", i);
    athletes.push({
      id,
      club_id: "club-1",
      is_active: true,
      full_name: `Atleta ${i}`,
      team: "Sub-15",
      category: "Sub-15",
      position: ["Atacante"],
      jersey_num: i,
      current_pain: i === 2 ? "Joelho" : "Nenhuma",
      photo_url: `fotos/${i}.jpg`,
      photo_color: "#111",
      // O painel mostra os mais recentes: o 8 é o mais novo.
      created_at: `2026-01-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
    });
    for (let e = 0; e < 5; e++) {
      game_events.push({
        id: idFalso("e0e70000", i * 10 + e),
        athlete_id: id,
        game_id: "g1",
        event_type: "Gol",
      });
    }
  }
  athletes.push({
    id: idFalso("a7e1e700", 99),
    club_id: "club-1",
    is_active: false,
    deactivated_at: `${hoje.slice(0, 7)}-01`,
  });
  return {
    athletes,
    game_events,
    checkins: [{ athlete_id: idFalso("a7e1e700", 1), club_id: "club-1", checkin_date: hoje }],
    meetings: [
      {
        id: "m1",
        club_id: "club-1",
        athlete_id: idFalso("a7e1e700", 1),
        title: "Conversa sobre treino",
        status: "Agendado",
        scheduled_date: somaDias(hoje, 2),
        scheduled_time: "10:00:00",
        meeting_type: "Presencial",
      },
    ],
    athlete_charges: [
      { club_id: "club-1", amount_cents: 10000, discount_cents: 0, status: "Pendente", due_date: somaDias(hoje, 3) },
    ],
    partner_clubs: [
      { club_id: "club-1", name: "Vertice Sub-15", is_managed: true },
      { club_id: "club-1", name: "Time Parceiro", is_managed: false },
    ],
    games: [
      { id: "j1", club_id: "club-1", opponent: "Adversario Gerido", target_team: "Vertice Sub-15", scheduled_date: somaDias(hoje, 4) },
      { id: "j2", club_id: "club-1", opponent: "Adversario Alheio", target_team: "Time Parceiro", scheduled_date: somaDias(hoje, 4) },
    ],
    plays: [{ id: "p1", club_id: "club-1" }],
  };
}

describe("DashboardPage: custo em consultas", () => {
  it("score dos 6 atletas em lote e as consultas finais junto das demais", async () => {
    estado.chamadasDeAssinatura = 0;
    const f = criarSupabaseFalso(montarClube());
    estado.cliente = f.client;

    const pagina = await DashboardPage();

    // Antes: 7 (primeiro lote) + 42 (score, uma chamada por atleta) + churn +
    // clubes geridos + jogos + 4 do checklist = 56 consultas, em 6 rodadas
    // sequenciais. Agora: o mesmo conteúdo em 21 consultas e 2 rodadas.
    expect(f.contar()).toBe(21);
    expect(f.rodadas()).toBe(2);

    // O score sai de UMA leitura de cada tabela, não de seis.
    expect(f.contar("game_events")).toBe(1);
    expect(f.contar("exercises")).toBe(1);
    expect(f.contar("game_lineups")).toBe(1);

    // E as fotos são assinadas numa chamada só.
    expect(estado.chamadasDeAssinatura).toBe(1);

    expect(pagina).toBeTruthy();
  });

  it("continua mostrando o mesmo conteúdo: 6 atletas com nota e foto, jogos só da equipe gerida", async () => {
    const f = criarSupabaseFalso(montarClube());
    estado.cliente = f.client;

    // Elementos React são objetos simples: o JSON mostra o que a página montou
    // sem precisar renderizar. Os tipos de componente (funções/objetos com
    // referência circular) e os campos internos "_" ficam de fora.
    const arvore = JSON.stringify(await DashboardPage(), (chave, valor) =>
      chave.startsWith("_") || (chave === "type" && typeof valor !== "string") ? undefined : valor,
    );

    for (const n of [8, 7, 6, 5, 4, 3]) expect(arvore).toContain(`Atleta ${n}`);
    expect(arvore).not.toContain('"Atleta 2"');
    expect(arvore).not.toContain('"Atleta 1"');
    expect(arvore).toContain("https://assinada.test/fotos/8.jpg");
    expect(arvore).toContain("Adversario Gerido");
    expect(arvore).not.toContain("Adversario Alheio");
    expect(arvore).toContain("Conversa sobre treino");
  });

  it("sem equipe sob gestão não consulta jogos", async () => {
    const t = montarClube();
    t.partner_clubs = [{ club_id: "club-1", name: "Time Parceiro", is_managed: false }];
    const f = criarSupabaseFalso(t);
    estado.cliente = f.client;

    await DashboardPage();

    // A única leitura de games que sobra é a contagem do checklist de primeiros passos.
    expect(f.contar("games")).toBe(1);
    expect(f.contar()).toBe(20);
  });

  it("o custo não depende de quantos atletas o clube tem (o painel mostra sempre 6)", async () => {
    const t = montarClube();
    for (let i = 100; i < 500; i++) {
      t.athletes.push({
        id: idFalso("a7e1e700", i),
        club_id: "club-1",
        is_active: true,
        full_name: `Atleta ${i}`,
        category: "Sub-15",
        position: ["Fixo"],
        created_at: `2025-01-01T00:00:00Z`,
      });
    }
    const f = criarSupabaseFalso(t);
    estado.cliente = f.client;

    await DashboardPage();

    expect(f.contar()).toBe(21);
  });
});

/** Texto do cartão, como a página formata (o espaço após "R$" é não separável). */
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Leituras de cobrança da própria página (paginadas); a do checklist de primeiros passos não pagina. */
const paginasDeCobrancas = (f: ReturnType<typeof criarSupabaseFalso>) =>
  f.consultas.filter((c) => c.tabela === "athlete_charges" && c.faixa !== null).length;

/** Elementos React são objetos simples: o JSON mostra o que a página montou. */
async function renderizarComoTexto() {
  return JSON.stringify(await DashboardPage(), (chave, valor) =>
    chave.startsWith("_") || (chave === "type" && typeof valor !== "string") ? undefined : valor,
  );
}

describe("DashboardPage: cobranças em aberto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** 1.200 a vencer (R$ 100) + 300 atrasadas (R$ 50): 1.500 linhas, mais que o corte de 1000. */
  function clubeComMuitasCobrancas() {
    const t = montarClube();
    const hoje = hojeISO();
    t.athlete_charges = [];
    for (let i = 1; i <= 1500; i++) {
      const atrasada = i > 1200;
      t.athlete_charges.push({
        id: idFalso("c4a76e00", i),
        club_id: "club-1",
        amount_cents: atrasada ? 5000 : 10000,
        discount_cents: 0,
        status: atrasada ? "Atrasado" : "Pendente",
        due_date: atrasada ? somaDias(hoje, -10) : somaDias(hoje, 3),
      });
    }
    return t;
  }

  it("clube com mais de 1000 cobranças em aberto: os totais somam todas, não só a primeira página", async () => {
    const f = criarSupabaseFalso(clubeComMuitasCobrancas());
    estado.cliente = f.client;

    const arvore = await renderizarComoTexto();

    // Em aberto: 1.200 × 100 + 300 × 50 = 135.000. Inadimplência: 300 × 50 = 15.000 (11%).
    // A 7 dias: só as 1.200 a vencer. Com o corte de 1000 linhas o total saía 100.000 a menos.
    expect(arvore).toContain(brl(13_500_000));
    expect(arvore).toContain(brl(1_500_000));
    expect(arvore).toContain(brl(12_000_000));
    // Os cartões são montados em pedaços ("lançamento", "s", ...): o contador vem separado.
    expect(arvore).toContain('"children":[300," lançamento","s"," atrasado","s"]');
    expect(paginasDeCobrancas(f)).toBe(2);
  });

  it("abaixo de 1000 cobranças continua sendo uma consulta só", async () => {
    const f = criarSupabaseFalso(montarClube());
    estado.cliente = f.client;

    await DashboardPage();

    expect(paginasDeCobrancas(f)).toBe(1);
  });

  it("se a leitura das cobranças falhar, os cartões não mostram um total parcial como se fosse certo", async () => {
    const f = criarSupabaseFalso(clubeComMuitasCobrancas());
    f.falharEm("athlete_charges");
    estado.cliente = f.client;
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const arvore = await renderizarComoTexto();

    expect(arvore).not.toContain("R$");
    expect(arvore).not.toContain("lançamentos atrasados");
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("cobranças em aberto"));
    // O resto do painel segue de pé.
    expect(arvore).toContain("Atleta 8");
  });
});
