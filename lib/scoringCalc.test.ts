import { describe, it, expect } from "vitest";
import {
  calcularPlayerScore,
  clamp,
  type EntradaScore,
} from "@/lib/scoringCalc";
import { criarAleatorio } from "@/lib/testing/supabaseFalso";

const HOJE = "2026-06-15";

function entrada(parcial: Partial<EntradaScore> = {}): EntradaScore {
  return {
    hoje: HOJE,
    eventos: [],
    exercicios: [],
    encontros: [],
    confiancas: [],
    swot: [],
    posicoes: [],
    escalacoes: [],
    ...parcial,
  };
}

const evento = (event_type: string, game_id = "g1") => ({ event_type, game_id });
function vezes<T>(n: number, item: T) {
  return Array.from({ length: n }, () => item);
}

/** Cinco jogos passados, do mais antigo (g1) ao mais recente (g5). */
const CINCO_JOGOS = ["g1", "g2", "g3", "g4", "g5"].map((id, i) => ({
  game_id: id,
  data: `2026-05-${String(10 + i).padStart(2, "0")}`,
}));

describe("clamp", () => {
  it("limita entre 0 e 99 e arredonda", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(99);
    expect(clamp(72.4)).toBe(72);
    expect(clamp(72.5)).toBe(73);
  });
});

describe("atleta sem nenhum dado", () => {
  it("fica neutro em tudo (50), exceto disciplina que começa em 99", () => {
    const s = calcularPlayerScore(entrada());
    expect(s).toEqual({
      overall: 57,
      attack: 50,
      defense: 50,
      discipline: 99,
      physical: 50,
      mental: 50,
      commitment: 50,
      development: 50,
      warnings: [],
    });
  });

  it("o geral de quem não tem dado é 57, não 50: a disciplina cheia puxa a média", () => {
    // (50*6 + 99) / 7 = 57. Documenta o comportamento real, que o comentário
    // antigo ("fica em 50") não descrevia.
    expect(calcularPlayerScore(entrada()).overall).toBe(57);
  });
});

describe("ataque", () => {
  it("soma gol (8), assistência (5), finalização certa (2) e desconta a errada (1)", () => {
    const s = calcularPlayerScore(
      entrada({
        eventos: [
          ...vezes(2, evento("Gol")),
          ...vezes(3, evento("Assistência")),
          ...vezes(4, evento("Finalização certa")),
          ...vezes(5, evento("Finalização errada")),
        ],
      }),
    );
    // 50 + 16 + 15 + 8 - 5
    expect(s.attack).toBe(84);
  });

  it("evento sem relação com ataque ainda tira a nota do neutro (quem tem súmula é avaliado)", () => {
    const s = calcularPlayerScore(entrada({ eventos: [evento("Falta")] }));
    expect(s.attack).toBe(50);
    expect(s.discipline).toBe(96);
  });
});

describe("goleiro versus atacante", () => {
  const defesas = vezes(6, evento("Defesa"));

  it("goleiro com defesas tem defesa alta e ataque neutro", () => {
    const s = calcularPlayerScore(entrada({ posicoes: ["Goleiro"], eventos: defesas }));
    expect(s.defense).toBe(86); // 50 + 6*6
    expect(s.attack).toBe(50);
  });

  it("atacante com gols tem ataque alto e defesa neutra", () => {
    const s = calcularPlayerScore(
      entrada({ posicoes: ["Atacante"], eventos: vezes(4, evento("Gol")) }),
    );
    expect(s.attack).toBe(82); // 50 + 4*8
    expect(s.defense).toBe(50);
  });

  it("a seca de gols só pune quem joga no ataque, não o goleiro", () => {
    const base = { escalacoes: CINCO_JOGOS, eventos: [evento("Desarme", "g5")] };
    const goleiro = calcularPlayerScore(entrada({ ...base, posicoes: ["Goleiro"] }));
    const atacante = calcularPlayerScore(entrada({ ...base, posicoes: ["Atacante"] }));
    expect(goleiro.attack).toBe(50);
    expect(goleiro.warnings).toEqual([]);
    expect(atacante.attack).toBe(38); // 50 - 12
    expect(atacante.warnings).toHaveLength(1);
  });

  it.each(["Atacante", "Pivô", "Ala"])("%s conta como posição de ataque", (posicao) => {
    const s = calcularPlayerScore(
      entrada({ posicoes: [posicao], escalacoes: CINCO_JOGOS, eventos: [evento("Falta", "g5")] }),
    );
    expect(s.attack).toBe(38);
  });

  it("basta uma das posições ser de ataque", () => {
    const s = calcularPlayerScore(
      entrada({ posicoes: ["Fixo", "Pivô"], escalacoes: CINCO_JOGOS, eventos: [evento("Falta")] }),
    );
    expect(s.attack).toBe(38);
  });
});

describe("sequência fria de jogos (seca de gols)", () => {
  const atacante = (parcial: Partial<EntradaScore>) =>
    calcularPlayerScore(entrada({ posicoes: ["Atacante"], ...parcial }));

  it("5 jogos recentes sem gol: ataque cai 12 e avisa quantos jogos", () => {
    const s = atacante({ escalacoes: CINCO_JOGOS, eventos: [evento("Desarme")] });
    expect(s.attack).toBe(38);
    expect(s.warnings).toEqual([
      "⚠️ Sem gols nas últimas 5 partidas — finalização penalizada no ataque.",
    ]);
  });

  it("com 3 jogos já pune (mínimo), com 2 não", () => {
    const tres = atacante({ escalacoes: CINCO_JOGOS.slice(0, 3), eventos: [evento("Desarme")] });
    expect(tres.attack).toBe(38);
    expect(tres.warnings[0]).toContain("últimas 3 partidas");

    const dois = atacante({ escalacoes: CINCO_JOGOS.slice(0, 2), eventos: [evento("Desarme")] });
    expect(dois.attack).toBe(50);
    expect(dois.warnings).toEqual([]);
  });

  it("um gol em qualquer dos 5 jogos recentes desfaz a punição", () => {
    const s = atacante({
      escalacoes: CINCO_JOGOS,
      eventos: [evento("Gol", "g3"), evento("Desarme")],
    });
    expect(s.attack).toBe(58); // 50 + 8, sem desconto
    expect(s.warnings).toEqual([]);
  });

  it("gol num jogo MAIS ANTIGO que os 5 recentes não conta como recente", () => {
    const seisJogos = [{ game_id: "antigo", data: "2026-01-01" }, ...CINCO_JOGOS];
    const s = atacante({ escalacoes: seisJogos, eventos: [evento("Gol", "antigo")] });
    // O gol vale no acumulado (50 + 8), mas o jogo de janeiro ficou fora da
    // janela de 5, então a seca de 5 jogos desconta 12.
    expect(s.attack).toBe(46);
    expect(s.warnings).toHaveLength(1);
  });

  it("jogo no futuro ou sem data não entra na janela", () => {
    const s = atacante({
      escalacoes: [
        ...CINCO_JOGOS.slice(0, 2), // só 2 válidos
        { game_id: "futuro1", data: "2026-12-01" },
        { game_id: "futuro2", data: "2026-12-02" },
        { game_id: "semData", data: null },
      ],
      eventos: [evento("Desarme")],
    });
    expect(s.attack).toBe(50);
    expect(s.warnings).toEqual([]);
  });

  it("jogo de hoje conta (a data é inclusiva)", () => {
    const s = atacante({
      escalacoes: [
        { game_id: "a", data: "2026-06-13" },
        { game_id: "b", data: "2026-06-14" },
        { game_id: "c", data: HOJE },
      ],
      eventos: [evento("Desarme")],
    });
    expect(s.attack).toBe(38);
  });

  it("não altera a lista de escalações recebida", () => {
    const escalacoes = [...CINCO_JOGOS].reverse();
    const copia = JSON.stringify(escalacoes);
    atacante({ escalacoes, eventos: [evento("Desarme")] });
    expect(JSON.stringify(escalacoes)).toBe(copia);
  });

  it("a punição não leva o ataque abaixo de 0", () => {
    const s = atacante({
      escalacoes: CINCO_JOGOS,
      eventos: vezes(60, evento("Finalização errada", "g1")),
    });
    expect(s.attack).toBe(0);
  });
});

describe("defesa e disciplina (cartões)", () => {
  it("desarme 5, interceptação 4, defesa 6", () => {
    const s = calcularPlayerScore(
      entrada({
        eventos: [...vezes(2, evento("Desarme")), ...vezes(3, evento("Interceptação")), evento("Defesa")],
      }),
    );
    expect(s.defense).toBe(78); // 50 + 10 + 12 + 6
  });

  it("amarelo -8, vermelho -20, falta -3", () => {
    const s = calcularPlayerScore(
      entrada({
        eventos: [
          ...vezes(2, evento("Cartão amarelo")),
          evento("Cartão vermelho"),
          ...vezes(3, evento("Falta")),
        ],
      }),
    );
    expect(s.discipline).toBe(54); // 99 - 16 - 20 - 9
  });

  it("disciplina nunca fica negativa", () => {
    const s = calcularPlayerScore(entrada({ eventos: vezes(10, evento("Cartão vermelho")) }));
    expect(s.discipline).toBe(0);
  });
});

describe("clamp 0 a 99 nas dimensões", () => {
  it("ataque e defesa não passam de 99", () => {
    const s = calcularPlayerScore(
      entrada({ eventos: [...vezes(30, evento("Gol")), ...vezes(30, evento("Defesa"))] }),
    );
    expect(s.attack).toBe(99);
    expect(s.defense).toBe(99);
  });

  it("ataque não fica abaixo de 0", () => {
    const s = calcularPlayerScore(entrada({ eventos: vezes(200, evento("Finalização errada")) }));
    expect(s.attack).toBe(0);
  });

  it("físico, compromisso e desenvolvimento ficam entre 30 e 99 quando há dado", () => {
    const nenhum = calcularPlayerScore(
      entrada({
        exercicios: vezes(4, { done: false }),
        encontros: vezes(4, { athlete_confirmed: false }),
        swot: vezes(4, { status: "Pendente" }),
      }),
    );
    expect(nenhum.physical).toBe(30);
    expect(nenhum.commitment).toBe(30);
    expect(nenhum.development).toBe(30);

    const todos = calcularPlayerScore(
      entrada({
        exercicios: vezes(4, { done: true }),
        encontros: vezes(4, { athlete_confirmed: true }),
        swot: vezes(4, { status: "Concluído" }),
      }),
    );
    expect(todos.physical).toBe(99);
    expect(todos.commitment).toBe(99);
    expect(todos.development).toBe(99);
  });

  it("o geral nunca sai de 0 a 99", () => {
    const pior = calcularPlayerScore(
      entrada({
        eventos: vezes(200, evento("Cartão vermelho")),
        exercicios: [{ done: false }],
        encontros: [{ athlete_confirmed: false }],
        confiancas: [0],
        swot: [{ status: "Pendente" }],
      }),
    );
    expect(pior.overall).toBeGreaterThanOrEqual(0);
    const melhor = calcularPlayerScore(
      entrada({
        eventos: [...vezes(40, evento("Gol")), ...vezes(40, evento("Defesa"))],
        exercicios: [{ done: true }],
        encontros: [{ athlete_confirmed: true }],
        confiancas: [10, 10],
        swot: [{ status: "Concluído" }],
      }),
    );
    expect(melhor.overall).toBeLessThanOrEqual(99);
  });
});

describe("físico, mental, compromisso, desenvolvimento", () => {
  it("físico: metade dos treinos feitos = 30 + 0,5 × 69", () => {
    const s = calcularPlayerScore(
      entrada({ exercicios: [{ done: true }, { done: false }] }),
    );
    expect(s.physical).toBe(65); // 64,5 arredonda para 65
  });

  it("mental: média das notas × 9,9, ignorando as nulas", () => {
    const s = calcularPlayerScore(entrada({ confiancas: [8, null, 6] }));
    expect(s.mental).toBe(69); // média 7 × 9,9 = 69,3
  });

  it("mental: só notas nulas = neutro", () => {
    expect(calcularPlayerScore(entrada({ confiancas: [null, null] })).mental).toBe(50);
  });

  it("compromisso: conta só encontros confirmados", () => {
    const s = calcularPlayerScore(
      entrada({
        encontros: [
          { athlete_confirmed: true },
          { athlete_confirmed: true },
          { athlete_confirmed: true },
          { athlete_confirmed: false },
        ],
      }),
    );
    expect(s.commitment).toBe(82); // 30 + 0,75 × 69 = 81,75
  });

  it("desenvolvimento: só status 'Concluído' conta como feito", () => {
    const s = calcularPlayerScore(
      entrada({
        swot: [{ status: "Concluído" }, { status: "Em andamento" }, { status: "Pendente" }, { status: "Concluído" }],
      }),
    );
    expect(s.development).toBe(65); // 30 + 0,5 × 69 = 64,5
  });
});

describe("geral", () => {
  it("é a média arredondada das sete dimensões", () => {
    const s = calcularPlayerScore(
      entrada({
        eventos: [evento("Gol"), evento("Desarme"), evento("Falta")],
        exercicios: [{ done: true }],
        encontros: [{ athlete_confirmed: true }],
        confiancas: [7],
        swot: [{ status: "Concluído" }],
      }),
    );
    const media =
      (s.attack + s.defense + s.discipline + s.physical + s.mental + s.commitment + s.development) / 7;
    expect(s.overall).toBe(Math.round(media));
  });
});

describe("determinismo", () => {
  it("a mesma entrada dá o mesmo score, e a ordem das linhas não importa", () => {
    const rnd = criarAleatorio(42);
    const tipos = ["Gol", "Assistência", "Falta", "Desarme", "Cartão amarelo"];
    const eventos = Array.from({ length: 40 }, () => ({
      event_type: tipos[Math.floor(rnd() * tipos.length)],
      game_id: `g${Math.floor(rnd() * 5) + 1}`,
    }));
    const a = calcularPlayerScore(entrada({ posicoes: ["Ala"], escalacoes: CINCO_JOGOS, eventos }));
    const b = calcularPlayerScore(
      entrada({ posicoes: ["Ala"], escalacoes: [...CINCO_JOGOS].reverse(), eventos: [...eventos].reverse() }),
    );
    expect(b).toEqual(a);
  });
});
