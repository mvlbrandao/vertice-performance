import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const estado = vi.hoisted(() => ({
  cliente: null as unknown,
  caches: [] as Map<string, unknown>[],
  /** Opções de cada unstable_cache do módulo, pela primeira parte da chave. */
  opcoesPorChave: {} as Record<string, { revalidate?: number; tags?: string[] }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => estado.cliente }));
// Memoização simples por argumento: imita o contrato do unstable_cache (mesmos
// argumentos => resultado guardado; função que lança não guarda nada). O cache
// REAL do Next não roda fora do servidor, então o que este teste prova é a
// ligação do código com ele, não o comportamento do Data Cache.
vi.mock("next/cache", () => ({
  unstable_cache: <A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    chave: string[],
    opcoes: { revalidate?: number; tags?: string[] },
  ) => {
    const memo = new Map<string, unknown>();
    estado.caches.push(memo);
    estado.opcoesPorChave[chave[0]] = opcoes;
    return async (...args: A) => {
      const argumentos = JSON.stringify(args);
      if (!memo.has(argumentos)) memo.set(argumentos, await fn(...args));
      return memo.get(argumentos) as R;
    };
  },
}));

import { getClubPeerClouds, getSystemPercentile } from "@/lib/scouting/peerScoring";
import { computePlayerScores } from "@/lib/scoring";
import { percentileRank } from "@/lib/scouting/percentile";
import { criarSupabaseFalso, montarPlataforma, type Linha } from "@/lib/testing/supabaseFalso";

function usar(tabelas: Record<string, Linha[]>, opcoes = {}) {
  const f = criarSupabaseFalso(tabelas, opcoes);
  estado.cliente = f.client;
  return f;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T15:00:00Z"));
  for (const memo of estado.caches) memo.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getClubPeerClouds", () => {
  // Dois clubes de 3 categorias × 20 atletas. Só o primeiro interessa.
  const t = montarPlataforma({
    clubes: 2,
    categorias: ["Sub-13", "Sub-15", "Sub-17"],
    atletasPorCategoria: 20,
    eventosPorAtleta: 8,
  });
  const doClube1 = t.athletes.filter((a) => a.club_id === t.athletes[0].club_id);
  const eu = doClube1.find((a) => a.category === "Sub-15") as Linha;
  const colegas = doClube1.filter((a) => a.id !== eu.id);

  it("calcula o clube UMA vez: 1 leitura de atletas + 7 do score, não duas passadas", async () => {
    const f = usar(t);
    await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    // Antes: getClubPeerCloud era chamada duas vezes (com e sem categoria),
    // cada uma com 7 consultas POR colega. Agora são 8 no total.
    expect(f.contar("athletes")).toBe(2); // lista do clube + posições do score
    expect(f.contar()).toBe(8);
  });

  it("a segunda visualização do clube não toca no banco, nem a de OUTRO atleta do mesmo clube", async () => {
    const f = usar(t);
    const primeira = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    const consultas = f.contar();
    expect(consultas).toBe(8);

    const repetida = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    const outro = colegas.find((a) => a.category === "Sub-17") as Linha;
    const doOutro = await getClubPeerClouds(eu.club_id as string, outro.id as string, "Sub-17");

    expect(f.contar()).toBe(consultas);
    expect(repetida).toEqual(primeira);
    // Quem vê é retirado da lista em memória: cada um sem o próprio ponto.
    expect(primeira.clubCloud).toHaveLength(59);
    expect(doOutro.clubCloud).toHaveLength(59);
    expect(doOutro.categoryCloud).toHaveLength(19);
  });

  it("clubes diferentes têm caches diferentes, sem misturar pares", async () => {
    const f = usar(t);
    const outroClube = t.athletes.find((a) => a.club_id !== eu.club_id) as Linha;
    const meu = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    const depoisDoPrimeiro = f.contar();
    const dele = await getClubPeerClouds(outroClube.club_id as string, outroClube.id as string, "Sub-15");

    expect(f.contar()).toBeGreaterThan(depoisDoPrimeiro);
    // Mesmo formato de clube (60 atletas), mas dados sorteados diferentes.
    expect(dele.clubCloud).toHaveLength(59);
    expect(dele.clubCloud).not.toEqual(meu.clubCloud);
  });

  it("clubCloud tem todos os colegas e categoryCloud só os do mesmo sub, sem o próprio atleta", async () => {
    const f = usar(t);
    const { categoryCloud, clubCloud } = await getClubPeerClouds(
      eu.club_id as string,
      eu.id as string,
      "Sub-15",
    );
    const scores = await computePlayerScores(
      f.client as never,
      colegas.map((a) => a.id as string),
    );
    const ponto = (a: Linha) => {
      const s = scores.get(a.id as string)!;
      return { x: s.attack, y: s.defense };
    };

    expect(clubCloud).toHaveLength(59);
    expect(categoryCloud).toHaveLength(19);
    const ordena = (p: { x: number; y: number }[]) =>
      [...p].sort((a, b) => a.x - b.x || a.y - b.y);
    expect(ordena(clubCloud)).toEqual(ordena(colegas.map(ponto)));
    expect(ordena(categoryCloud)).toEqual(
      ordena(colegas.filter((a) => a.category === "Sub-15").map(ponto)),
    );
  });

  it("devolve só números anônimos: nenhum id, categoria ou campo extra de outro atleta", async () => {
    usar(t);
    const r = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    const json = JSON.stringify(r);
    for (const a of doClube1) expect(json).not.toContain(a.id as string);
    expect(json).not.toContain("Sub-15");
    for (const p of [...r.categoryCloud, ...r.clubCloud]) {
      expect(Object.keys(p).sort()).toEqual(["x", "y"]);
    }
  });

  it("não puxa atletas de outro clube (o outro clube tem mais 60)", async () => {
    usar(t);
    const r = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    expect(r.clubCloud).toHaveLength(59);
  });

  it("sem categoria, o 'sub' é o clube inteiro (como a consulta sem filtro era)", async () => {
    usar(t);
    const r = await getClubPeerClouds(eu.club_id as string, eu.id as string, null);
    expect(r.categoryCloud).toEqual(r.clubCloud);
  });

  it("clube sem colegas: nuvens vazias", async () => {
    usar({ athletes: [{ id: "x", club_id: "c", category: "Sub-15", is_active: true }] });
    const r = await getClubPeerClouds("c", "x", "Sub-15");
    expect(r).toEqual({ categoryCloud: [], clubCloud: [] });
  });

  it("clube sem nenhum atleta ativo: nuvens vazias e uma consulta só", async () => {
    const f = usar({ athletes: [] });
    const r = await getClubPeerClouds("c", "x", "Sub-15");
    expect(r).toEqual({ categoryCloud: [], clubCloud: [] });
    expect(f.contar()).toBe(1);
  });

  it("se a leitura do score falhar, devolve nuvens vazias em vez de pontos neutros", async () => {
    const f = usar(t);
    f.falharEm("game_events");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    expect(r).toEqual({ categoryCloud: [], clubCloud: [] });
    expect(erro).toHaveBeenCalled();
  });

  it("falha na leitura do clube NÃO fica em cache: a visualização seguinte acerta", async () => {
    const quebrado = usar(t);
    quebrado.falharEm("game_events");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const falha = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    expect(falha.clubCloud).toEqual([]);

    // Banco volta: se a falha tivesse sido guardada, a lista continuaria vazia.
    const sadio = usar(t);
    const r = await getClubPeerClouds(eu.club_id as string, eu.id as string, "Sub-15");
    expect(r.clubCloud).toHaveLength(59);
    expect(sadio.contar()).toBe(8);
  });

  it("configura TTL de 5 min e a tag de invalidação dos pares do clube", () => {
    const opcoes = estado.opcoesPorChave["scouting-club-peers-v1"];
    expect(opcoes?.revalidate).toBe(300);
    expect(opcoes?.tags).toContain("club-peer-cloud");
  });
});

describe("getSystemPercentile", () => {
  function categoriaGrande(n: number) {
    return montarPlataforma({
      clubes: 4,
      categorias: ["Sub-15"],
      atletasPorCategoria: n / 4,
      eventosPorAtleta: 4,
    });
  }
  const proprio = { attack: 62, defense: 48 };

  it("o custo NÃO cresce com a plataforma: 400 ou 2000 atletas custam as mesmas 15 consultas", async () => {
    const pequena = usar(categoriaGrande(400));
    await getSystemPercentile("fora-da-amostra", "Sub-15", proprio);
    const consultasPequena = pequena.contar();

    for (const memo of estado.caches) memo.clear();
    const grande = usar(categoriaGrande(2000));
    await getSystemPercentile("fora-da-amostra", "Sub-15", proprio);

    // 1 leitura da amostra (200 ids) + 2 fatias × 7 consultas.
    expect(consultasPequena).toBe(15);
    expect(grande.contar()).toBe(15);
  });

  it("compara contra uma amostra estável de 200 (primeiros por id) e conta o próprio atleta", async () => {
    const t = categoriaGrande(1000);
    const f = usar(t);
    const r = await getSystemPercentile("fora-da-amostra", "Sub-15", proprio);

    const amostraIds = t.athletes
      .map((a) => a.id as string)
      .sort()
      .slice(0, 200);
    const scores = await computePlayerScores(f.client as never, amostraIds);
    const ataques = [...amostraIds.map((id) => scores.get(id)!.attack), proprio.attack];
    const defesas = [...amostraIds.map((id) => scores.get(id)!.defense), proprio.defense];

    expect(r).toEqual({
      attackPercentile: percentileRank(proprio.attack, ataques),
      defensePercentile: percentileRank(proprio.defense, defesas),
      sampleSize: 201,
    });
  });

  it("se o atleta já está na amostra, não é contado duas vezes", async () => {
    const t = categoriaGrande(1000);
    usar(t);
    const primeiro = t.athletes.map((a) => a.id as string).sort()[0];
    const r = await getSystemPercentile(primeiro, "Sub-15", proprio);
    expect(r?.sampleSize).toBe(200);
  });

  it("segundo acesso da mesma categoria não toca no banco; a posição própria segue ao vivo", async () => {
    const f = usar(categoriaGrande(400));
    const a = await getSystemPercentile("fora-da-amostra", "Sub-15", { attack: 40, defense: 40 });
    const consultas = f.contar();
    const b = await getSystemPercentile("outro-atleta", "Sub-15", { attack: 90, defense: 90 });

    expect(f.contar()).toBe(consultas);
    expect(b!.attackPercentile).toBeGreaterThan(a!.attackPercentile);
    expect(b!.defensePercentile).toBeGreaterThan(a!.defensePercentile);
  });

  it("categorias diferentes têm caches diferentes", async () => {
    const t = montarPlataforma({
      clubes: 2,
      categorias: ["Sub-15", "Sub-17"],
      atletasPorCategoria: 10,
    });
    const f = usar(t);
    await getSystemPercentile("x", "Sub-15", proprio);
    const depoisDaPrimeira = f.contar();
    await getSystemPercentile("x", "Sub-17", proprio);
    expect(f.contar()).toBeGreaterThan(depoisDaPrimeira);
  });

  it("amostra mínima: com menos de 5 atletas comparáveis devolve null", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 3 });
    usar(t);
    expect(await getSystemPercentile("x", "Sub-15", proprio)).toBeNull();
  });

  it("exatamente 5 (4 + o próprio) já devolve resultado", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 4 });
    usar(t);
    expect((await getSystemPercentile("x", "Sub-15", proprio))?.sampleSize).toBe(5);
  });

  it("sem categoria devolve null sem consultar nada", async () => {
    const f = usar(categoriaGrande(40));
    expect(await getSystemPercentile("x", null, proprio)).toBeNull();
    expect(f.contar()).toBe(0);
  });

  it("só atletas ativos entram na amostra", async () => {
    const t = montarPlataforma({ clubes: 1, categorias: ["Sub-15"], atletasPorCategoria: 8 });
    for (const a of t.athletes.slice(0, 5)) a.is_active = false;
    usar(t);
    // 3 ativos + o próprio = 4 < 5
    expect(await getSystemPercentile("x", "Sub-15", proprio)).toBeNull();
  });

  it("falha na leitura: devolve null e NÃO guarda a falha em cache", async () => {
    const t = categoriaGrande(40);
    const f = usar(t);
    f.falharEm("exercises");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getSystemPercentile("x", "Sub-15", proprio)).toBeNull();
    expect(erro).toHaveBeenCalled();

    // Banco volta: a próxima visualização calcula de novo e acerta.
    const f2 = usar(t);
    expect(await getSystemPercentile("x", "Sub-15", proprio)).not.toBeNull();
    expect(f2.contar()).toBeGreaterThan(0);
  });

  it("só devolve três números; o cache nunca vai para o navegador", async () => {
    usar(categoriaGrande(40));
    const r = await getSystemPercentile("x", "Sub-15", proprio);
    expect(Object.keys(r as object).sort()).toEqual(["attackPercentile", "defensePercentile", "sampleSize"]);
  });

  it("configura TTL curto (10 min) e a tag de invalidação", () => {
    const opcoes = estado.opcoesPorChave["scouting-system-sample-v1"];
    expect(opcoes?.revalidate).toBe(600);
    expect(opcoes?.tags).toContain("system-percentile");
  });
});
