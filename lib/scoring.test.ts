import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/scoring.ts importa "server-only", que lança fora do bundle do servidor.
// Aqui o que se testa é a lógica de consulta, não essa proteção.
vi.mock("server-only", () => ({}));

import { computePlayerScore, computePlayerScores } from "@/lib/scoring";
import { calcularPlayerScore } from "@/lib/scoringCalc";
import {
  criarAleatorio,
  criarSupabaseFalso,
  idFalso,
  montarPlataforma,
  type Linha,
} from "@/lib/testing/supabaseFalso";

const HOJE = "2026-06-15";

beforeEach(() => {
  // Só Date: setTimeout/Promise reais, para o await dos builders não travar.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Cópia congelada da regra de score como ela era ANTES da refatoração
 * (computePlayerScore, versão por atleta). Serve de gabarito: a regra nova
 * tem que dar exatamente o mesmo número para qualquer entrada.
 */
function scoreLegado(input: {
  hoje: string;
  events: { event_type: string; game_id: string }[];
  exercises: { done: boolean }[];
  meetings: { athlete_confirmed: boolean }[];
  mentalNotes: { confidence_score: number | null }[];
  swotItems: { status: string }[];
  athlete: { position: string[] | null } | null;
  recentLineups: { game_id: string; games: { scheduled_date: string } | null }[];
}) {
  const { events, exercises, meetings, mentalNotes, swotItems, athlete, recentLineups } = input;
  const today = input.hoje;
  const clamp = (n: number, min = 0, max = 99) => Math.max(min, Math.min(max, Math.round(n)));
  const count = (type: string) => events.filter((e) => e.event_type === type).length;
  const warnings: string[] = [];

  const hasEvents = events.length > 0;
  let attack = hasEvents
    ? clamp(
        50 +
          count("Gol") * 8 +
          count("Assistência") * 5 +
          count("Finalização certa") * 2 -
          count("Finalização errada") * 1,
      )
    : 50;

  const isAttacker = (athlete?.position ?? []).some((p) => ["Atacante", "Pivô", "Ala"].includes(p));
  const recentGameIds = recentLineups
    .map((l) => ({ gameId: l.game_id, date: l.games?.scheduled_date }))
    .filter((g) => g.date && g.date <= today)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string))
    .slice(0, 5)
    .map((g) => g.gameId);

  if (isAttacker && recentGameIds.length >= 3) {
    const goalsInRecentGames = events.filter(
      (e) => e.event_type === "Gol" && recentGameIds.includes(e.game_id),
    ).length;
    if (goalsInRecentGames === 0) {
      attack = clamp(attack - 12);
      warnings.push(
        `⚠️ Sem gols nas últimas ${recentGameIds.length} partidas — finalização penalizada no ataque.`,
      );
    }
  }
  const defense = hasEvents
    ? clamp(50 + count("Desarme") * 5 + count("Interceptação") * 4 + count("Defesa") * 6)
    : 50;
  const discipline = hasEvents
    ? clamp(99 - (count("Cartão amarelo") * 8 + count("Cartão vermelho") * 20 + count("Falta") * 3))
    : 99;

  const totalExercises = exercises.length;
  const physical = totalExercises
    ? clamp(30 + (exercises.filter((e) => e.done).length / totalExercises) * 69)
    : 50;

  const confidenceScores = mentalNotes
    .map((m) => m.confidence_score)
    .filter((s): s is number => s != null);
  const mental = confidenceScores.length
    ? clamp((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 9.9)
    : 50;

  const totalMeetings = meetings.length;
  const commitment = totalMeetings
    ? clamp(30 + (meetings.filter((m) => m.athlete_confirmed).length / totalMeetings) * 69)
    : 50;

  const totalSwotIssues = swotItems.length;
  const development = totalSwotIssues
    ? clamp(30 + (swotItems.filter((s) => s.status === "Concluído").length / totalSwotIssues) * 69)
    : 50;

  const overall = clamp(
    (attack + defense + discipline + physical + mental + commitment + development) / 7,
  );
  return { overall, attack, defense, discipline, physical, mental, commitment, development, warnings };
}

/** Aplica o gabarito às linhas cruas de UM atleta, filtrando como as consultas filtram. */
function legadoDoAtleta(tabelas: Record<string, Linha[]>, athleteId: string) {
  const doAtleta = (t: string) => (tabelas[t] ?? []).filter((r) => r.athlete_id === athleteId);
  const atleta = (tabelas.athletes ?? []).find((a) => a.id === athleteId);
  return scoreLegado({
    hoje: HOJE,
    events: doAtleta("game_events") as never,
    exercises: doAtleta("exercises") as never,
    meetings: doAtleta("meetings").filter((m) => m.status !== "Cancelado") as never,
    mentalNotes: doAtleta("mental_notes").filter((m) => m.confidence_score != null) as never,
    swotItems: doAtleta("athlete_swot_items").filter((s) =>
      ["Fraqueza", "Ameaça"].includes(s.category as string),
    ) as never,
    athlete: (atleta as never) ?? null,
    recentLineups: doAtleta("game_lineups") as never,
  });
}

describe("regra nova == regra antiga", () => {
  it("dá o mesmo número em 500 entradas sorteadas, com todos os campos", () => {
    const rnd = criarAleatorio(2026);
    const inteiro = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
    const tipos = [
      "Gol",
      "Assistência",
      "Finalização certa",
      "Finalização errada",
      "Desarme",
      "Interceptação",
      "Defesa",
      "Cartão amarelo",
      "Cartão vermelho",
      "Falta",
      "Lesão",
    ];
    const posicoes = ["Goleiro", "Fixo", "Ala", "Pivô", "Atacante"];

    for (let i = 0; i < 500; i++) {
      const jogos = Array.from({ length: inteiro(0, 9) }, (_, j) => ({
        id: `g${j}`,
        // metade no passado, parte no futuro, algumas sem data
        data:
          rnd() < 0.1
            ? null
            : `2026-${String(inteiro(1, 9)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`,
      }));
      const eventos = Array.from({ length: inteiro(0, 30) }, () => ({
        event_type: tipos[inteiro(0, tipos.length - 1)],
        game_id: jogos.length ? jogos[inteiro(0, jogos.length - 1)].id : "g0",
      }));
      const exercicios = Array.from({ length: inteiro(0, 8) }, () => ({ done: rnd() < 0.5 }));
      const encontros = Array.from({ length: inteiro(0, 6) }, () => ({ athlete_confirmed: rnd() < 0.5 }));
      const confiancas = Array.from({ length: inteiro(0, 6) }, () => (rnd() < 0.2 ? null : inteiro(0, 10)));
      const swot = Array.from({ length: inteiro(0, 6) }, () => ({
        status: ["Pendente", "Em andamento", "Concluído"][inteiro(0, 2)],
      }));
      const posicao = rnd() < 0.1 ? null : [posicoes[inteiro(0, 4)], posicoes[inteiro(0, 4)]];

      const novo = calcularPlayerScore({
        hoje: HOJE,
        eventos,
        exercicios,
        encontros,
        confiancas,
        swot,
        posicoes: posicao ?? [],
        escalacoes: jogos.map((j) => ({ game_id: j.id, data: j.data })),
      });
      const antigo = scoreLegado({
        hoje: HOJE,
        events: eventos,
        exercises: exercicios,
        meetings: encontros,
        mentalNotes: confiancas.map((c) => ({ confidence_score: c })),
        swotItems: swot,
        athlete: { position: posicao },
        recentLineups: jogos.map((j) => ({
          game_id: j.id,
          games: j.data ? { scheduled_date: j.data } : null,
        })),
      });
      expect(novo).toEqual(antigo);
    }
  });
});

describe("computePlayerScores contra um banco falso", () => {
  const plataforma = montarPlataforma({
    clubes: 1,
    categorias: ["Sub-15"],
    atletasPorCategoria: 130,
    eventosPorAtleta: 20,
  });
  const idsDosAtletas = plataforma.athletes.map((a) => a.id as string);

  it("devolve, para cada atleta, o mesmo score da regra antiga (filtros inclusos)", async () => {
    const { client } = criarSupabaseFalso(plataforma);
    const scores = await computePlayerScores(client, idsDosAtletas);

    expect(scores.size).toBe(130);
    for (const id of idsDosAtletas) {
      expect(scores.get(id)).toEqual(legadoDoAtleta(plataforma, id));
    }
  });

  it("devolve na ordem pedida e ignora ids repetidas", async () => {
    const f = criarSupabaseFalso(plataforma);
    const ids = [idsDosAtletas[5], idsDosAtletas[1], idsDosAtletas[5], idsDosAtletas[3]];
    const scores = await computePlayerScores(f.client, ids);
    expect([...scores.keys()]).toEqual([idsDosAtletas[5], idsDosAtletas[1], idsDosAtletas[3]]);
  });

  it("lista vazia não consulta nada", async () => {
    const f = criarSupabaseFalso(plataforma);
    expect((await computePlayerScores(f.client, [])).size).toBe(0);
    expect(f.contar()).toBe(0);
  });

  it("id sem nenhum dado ganha a nota neutra, não some do mapa", async () => {
    const f = criarSupabaseFalso({});
    const id = idFalso("a7e1e700", 999);
    const scores = await computePlayerScores(f.client, [id]);
    expect(scores.get(id)?.overall).toBe(57);
    expect(scores.get(id)?.attack).toBe(50);
  });

  it("computePlayerScore (um atleta) dá o mesmo resultado do lote", async () => {
    const f = criarSupabaseFalso(plataforma);
    const id = idsDosAtletas[17];
    const unico = await computePlayerScore(f.client, id);
    const lote = await computePlayerScores(f.client, idsDosAtletas);
    expect(unico).toEqual(lote.get(id));
    expect(unico).toEqual(legadoDoAtleta(plataforma, id));
  });
});

describe("custo em consultas", () => {
  // Plataforma só de atletas sem muito dado: o foco aqui é contar idas ao banco.
  function plataformaCom(n: number) {
    return montarPlataforma({
      clubes: 1,
      categorias: ["Sub-15"],
      atletasPorCategoria: n,
      eventosPorAtleta: 3,
    });
  }
  const idsDe = (t: Record<string, Linha[]>) => t.athletes.map((a) => a.id as string);

  it("6 atletas (o dashboard) = 7 consultas, não 42", async () => {
    const t = plataformaCom(6);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.contar()).toBe(7);
  });

  it("um atleta (a ficha) = 7 consultas, como antes", async () => {
    const t = plataformaCom(3);
    const f = criarSupabaseFalso(t);
    await computePlayerScore(f.client, idsDe(t)[0]);
    expect(f.contar()).toBe(7);
  });

  it("até 100 atletas continua em 7 consultas", async () => {
    const t = plataformaCom(100);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.contar()).toBe(7);
  });

  it("101 atletas = 2 fatias = 14 consultas", async () => {
    const t = plataformaCom(101);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.contar()).toBe(14);
  });

  it("250 atletas = 3 fatias = 21 consultas, nenhuma .in() com mais de 100 ids", async () => {
    const t = plataformaCom(250);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.contar()).toBe(21);
    expect(f.maiorListaIn()).toBeLessThanOrEqual(100);
  });

  it("as fatias andam em paralelo até o teto de 3: 300 atletas ainda é uma rodada só", async () => {
    const t = plataformaCom(300);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.rodadas()).toBe(1);
  });

  it("acima do teto de fatias simultâneas as demais esperam: 5 fatias = 2 rodadas", async () => {
    const t = plataformaCom(450);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    expect(f.contar()).toBe(35);
    expect(f.rodadas()).toBe(2);
  });

  it("cada tabela é consultada uma vez por fatia", async () => {
    const t = plataformaCom(250);
    const f = criarSupabaseFalso(t);
    await computePlayerScores(f.client, idsDe(t));
    for (const tabela of [
      "game_events",
      "exercises",
      "meetings",
      "mental_notes",
      "athlete_swot_items",
      "athletes",
      "game_lineups",
    ]) {
      expect(f.contar(tabela)).toBe(3);
    }
  });
});

describe("limites do PostgREST", () => {
  it("com 600 atletas, a URL do PostgREST (≈150 ids) não estoura e o resultado é o correto", async () => {
    const t = montarPlataforma({
      clubes: 1,
      categorias: ["Sub-15"],
      atletasPorCategoria: 600,
      eventosPorAtleta: 2,
    });
    const ids = t.athletes.map((a) => a.id as string);
    // Teto de URL de ~150 ids por consulta: uma .in() de 600 ids falharia.
    const f = criarSupabaseFalso(t, { limiteDeUrl: 150 * 39 });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const scores = await computePlayerScores(f.client, ids);

    expect(erro).not.toHaveBeenCalled();
    expect(f.consultas.some((c) => c.falhou)).toBe(false);
    expect(scores.get(ids[0])).toEqual(legadoDoAtleta(t, ids[0]));
    expect(scores.get(ids[599])).toEqual(legadoDoAtleta(t, ids[599]));
  });

  it("sem fatiar a consulta falharia: o fake prova que o limite de URL é real", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 600 });
    const f = criarSupabaseFalso(t, { limiteDeUrl: 150 * 39 });
    const ids = t.athletes.map((a) => a.id);
    const resposta = await (f.client as unknown as {
      from: (t: string) => { select: () => { in: (c: string, v: unknown[]) => PromiseLike<{ error: unknown }> } };
    })
      .from("game_events")
      .select()
      .in("athlete_id", ids);
    expect(resposta.error).toMatchObject({ message: "URI too long" });
  });

  it("quando a súmula da fatia passa de 1000 linhas, lê as páginas seguintes (sem truncar em silêncio)", async () => {
    // 100 atletas com 30 eventos de 'Gol' cada = 3000 linhas numa fatia.
    const athletes: Linha[] = [];
    const game_events: Linha[] = [];
    const game_lineups: Linha[] = [];
    let n = 0;
    for (let i = 1; i <= 100; i++) {
      const id = idFalso("a7e1e700", i);
      athletes.push({ id, position: ["Atacante"] });
      for (let e = 0; e < 30; e++) {
        game_events.push({ id: idFalso("e0e70000", ++n), athlete_id: id, game_id: "g1", event_type: "Gol" });
      }
      game_lineups.push({ id: idFalso("1e0e0000", i), athlete_id: id, game_id: "g1", games: { scheduled_date: "2026-01-10" } });
    }
    const f = criarSupabaseFalso({ athletes, game_events, game_lineups }, { maxRows: 1000 });
    const ids = athletes.map((a) => a.id as string);
    const scores = await computePlayerScores(f.client, ids);

    // 30 gols => 50 + 240 => 99 para todo mundo. Truncado em 1000 linhas,
    // os últimos atletas ficariam sem eventos (50, neutro).
    for (const id of ids) expect(scores.get(id)?.attack).toBe(99);
    expect(f.contar("game_events")).toBe(4); // 3 páginas cheias + 1 vazia
  });
});

describe("falha de leitura", () => {
  it("por padrão degrada para a nota neutra, mas deixa rastro no log", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 4 });
    const f = criarSupabaseFalso(t);
    f.falharEm("game_events");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const ids = t.athletes.map((a) => a.id as string);
    const scores = await computePlayerScores(f.client, ids);

    expect(scores.size).toBe(4);
    for (const id of ids) {
      expect(scores.get(id)?.defense).toBe(50);
      expect(scores.get(id)?.discipline).toBe(99);
      // Sem os eventos, atacante com 3+ jogos recentes "não fez gol" e leva a
      // punição de seca (38): degradar em silêncio nem é sempre neutro, o que
      // reforça o motivo do log (e do falharEmErro para quem faz cache).
      expect([50, 38]).toContain(scores.get(id)?.attack);
    }
    expect(erro).toHaveBeenCalledTimes(1);
    expect(String(erro.mock.calls[0][0])).toContain("game_events");
  });

  it("com falharEmErro lança, para o cache não guardar nota neutra", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 4 });
    const f = criarSupabaseFalso(t);
    f.falharEm("exercises");
    await expect(
      computePlayerScores(f.client, t.athletes.map((a) => a.id as string), { falharEmErro: true }),
    ).rejects.toThrow(/exercises/);
  });
});
