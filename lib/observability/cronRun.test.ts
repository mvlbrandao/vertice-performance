import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("o teste não devia usar o client real");
  },
}));

import {
  CRON_TELEMETRY_TIMEOUT_MS,
  describeCronError,
  safeSummary,
  withCronRun,
  type CronOutcome,
  type CronRunDeps,
} from "./cronRun";

type Operacao =
  | { tipo: "abrir"; linha: Record<string, unknown> }
  | { tipo: "fechar"; id: unknown; campos: Record<string, unknown> }
  | { tipo: "inserir"; linha: Record<string, unknown> };

/** Client mínimo: só o que cronRun usa de cron_runs, registrando cada operação. */
function clienteFalso(
  opcoes: {
    aberturaFalha?: boolean;
    fechamentoFalha?: boolean;
    pendurado?: boolean;
    id?: number;
  } = {},
) {
  const operacoes: Operacao[] = [];
  const nunca = new Promise<never>(() => {});
  const client = {
    from(tabela: string) {
      if (tabela !== "cron_runs") throw new Error(`tabela inesperada: ${tabela}`);
      return {
        insert(linha: Record<string, unknown>) {
          const escreve = () => {
            // Com `.select().single()` é a abertura; sem, é a gravação inteira.
            return Promise.resolve({ error: null });
          };
          const resultado: PromiseLike<{ error: { message: string } | null }> & {
            select: (cols: string) => { single: () => PromiseLike<unknown> };
          } = {
            then: (ok, ko) => {
              operacoes.push({ tipo: "inserir", linha });
              if (opcoes.pendurado) return nunca.then(ok, ko);
              if (opcoes.fechamentoFalha) return Promise.resolve({ error: { message: "insert falhou" } }).then(ok, ko);
              return escreve().then(ok, ko);
            },
            select: () => ({
              single: () => {
                operacoes.push({ tipo: "abrir", linha });
                if (opcoes.pendurado) return nunca;
                if (opcoes.aberturaFalha) {
                  return Promise.resolve({ data: null, error: { message: "tabela ausente" } });
                }
                return Promise.resolve({ data: { id: opcoes.id ?? 77 }, error: null });
              },
            }),
          };
          // `then` do resultado só dispara quando ninguém chamou .select(): o
          // await direto vira "inserir". Quem chama .select() usa o ramo acima.
          return Object.assign(resultado, {});
        },
        update(campos: Record<string, unknown>) {
          return {
            eq(_coluna: string, id: unknown) {
              operacoes.push({ tipo: "fechar", id, campos });
              if (opcoes.pendurado) return nunca;
              if (opcoes.fechamentoFalha) return Promise.resolve({ error: { message: "update falhou" } });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, operacoes };
}

function deps(
  fake: ReturnType<typeof clienteFalso>,
  extra: Partial<CronRunDeps> = {},
): CronRunDeps & { eventos: Array<{ draft: Record<string, unknown>; options: unknown }> } {
  const eventos: Array<{ draft: Record<string, unknown>; options: unknown }> = [];
  let t = 1_000_000;
  return {
    client: (() => fake.client) as never,
    recordEvent: (async (draft: Record<string, unknown>, options: unknown) => {
      eventos.push({ draft, options });
      return true;
    }) as never,
    // Cada leitura do relógio avança 250 ms: duração previsível.
    now: () => (t += 250),
    eventos,
    ...extra,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("withCronRun", () => {
  it("execução ok: abre a linha, fecha com ok, duração e resumo, e devolve o valor intacto", async () => {
    const fake = clienteFalso({ id: 5 });
    const d = deps(fake);
    const valor = { corpo: "igual" };

    const out = await withCronRun(
      "billing-reminders",
      async (): Promise<CronOutcome<typeof valor>> => ({ value: valor, ok: true, summary: { enviados: 3 } }),
      d,
    );

    expect(out).toBe(valor);
    expect(fake.operacoes[0]).toMatchObject({ tipo: "abrir", linha: { job: "billing-reminders" } });
    const fechamento = fake.operacoes[1];
    expect(fechamento).toMatchObject({ tipo: "fechar", id: 5 });
    if (fechamento.tipo !== "fechar") throw new Error("esperava fechamento");
    expect(fechamento.campos).toMatchObject({ ok: true, summary: { enviados: 3 }, error: null });
    expect(fechamento.campos.duration_ms).toBe(250);
    expect(typeof fechamento.campos.finished_at).toBe("string");
    expect(d.eventos).toHaveLength(0);
  });

  it("ok:false mesmo sem exceção: grava ok=false, o erro e vira system_events por falha", async () => {
    const fake = clienteFalso({ id: 9 });
    const d = deps(fake);

    const out = await withCronRun(
      "club-retention",
      async (): Promise<CronOutcome<string>> => ({
        value: "resposta HTTP",
        ok: false,
        summary: { apagados: 0 },
        failures: [
          { message: "falha ao apagar o clube: 409 conflict", clubId: "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f" },
          { message: "restauração da demo falhou: slug duplicado" },
        ],
      }),
      d,
    );

    expect(out).toBe("resposta HTTP");
    const fechamento = fake.operacoes.find((o) => o.tipo === "fechar");
    if (!fechamento || fechamento.tipo !== "fechar") throw new Error("sem fechamento");
    expect(fechamento.campos.ok).toBe(false);
    expect(fechamento.campos.error).toBe("2 falhas; a primeira: falha ao apagar o clube: 409 conflict");
    expect(fechamento.campos.summary).toMatchObject({ apagados: 0, falhas: 2 });

    expect(d.eventos).toHaveLength(2);
    expect(d.eventos[0].draft).toMatchObject({
      source: "cron",
      severity: "error",
      route: "/api/cron/club-retention",
      clubId: "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f",
      message: "falha ao apagar o clube: 409 conflict",
    });
    expect(d.eventos[1].draft.clubId).toBeNull();
    // Falhas do cron têm teto próprio: não passam pelo limitador por fingerprint.
    expect(d.eventos[0].options).toEqual({ bypassLimiter: true });
  });

  it("falhas sem ok explícito também deixam a execução vermelha", async () => {
    const fake = clienteFalso();
    await withCronRun(
      "billing-reminders",
      async () => ({ value: 1, ok: true, failures: [{ message: "x" }] }),
      deps(fake),
    );
    const fechamento = fake.operacoes.find((o) => o.tipo === "fechar");
    if (!fechamento || fechamento.tipo !== "fechar") throw new Error("sem fechamento");
    expect(fechamento.campos.ok).toBe(false);
  });

  it("limita quantas falhas viram evento (100 clubes falhando igual não inundam)", async () => {
    const fake = clienteFalso();
    const d = deps(fake);
    await withCronRun(
      "club-retention",
      async () => ({
        value: 1,
        ok: false,
        failures: Array.from({ length: 100 }, (_, i) => ({ message: `falha ${i}` })),
      }),
      d,
    );
    expect(d.eventos).toHaveLength(20);
  });

  it("erro tratado (error) sem failures: ok=false e a mensagem vai para cron_runs.error", async () => {
    const fake = clienteFalso();
    await withCronRun(
      "club-retention",
      async () => ({ value: 1, ok: false, error: "falha ao listar clubes vencidos: timeout" }),
      deps(fake),
    );
    const fechamento = fake.operacoes.find((o) => o.tipo === "fechar");
    if (!fechamento || fechamento.tipo !== "fechar") throw new Error("sem fechamento");
    expect(fechamento.campos).toMatchObject({ ok: false, error: "falha ao listar clubes vencidos: timeout" });
  });

  it("se o cron LANÇA: registra a falha e relança a MESMA exceção (sem evento duplicado)", async () => {
    const fake = clienteFalso({ id: 3 });
    const d = deps(fake);
    const erro = new Error("banco fora do ar para ana@x.com");

    await expect(
      withCronRun("billing-reminders", async () => {
        throw erro;
      }, d),
    ).rejects.toBe(erro);

    const fechamento = fake.operacoes.find((o) => o.tipo === "fechar");
    if (!fechamento || fechamento.tipo !== "fechar") throw new Error("sem fechamento");
    expect(fechamento.campos.ok).toBe(false);
    expect(String(fechamento.campos.error)).toContain("banco fora do ar");
    // Dado pessoal na mensagem não vai para o banco.
    expect(String(fechamento.campos.error)).not.toContain("ana@x.com");
    // Quem registra a exceção é o onRequestError; aqui contar de novo duplicaria.
    expect(d.eventos).toHaveLength(0);
  });

  it("abertura falha: a linha inteira é gravada no fim (perder o 'começou' é aceitável)", async () => {
    const fake = clienteFalso({ aberturaFalha: true });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    const out = await withCronRun("billing-reminders", async () => ({ value: "v", ok: true }), deps(fake));

    expect(out).toBe("v");
    expect(aviso).toHaveBeenCalled();
    const inserida = fake.operacoes.find((o) => o.tipo === "inserir");
    expect(inserida).toBeDefined();
    if (!inserida || inserida.tipo !== "inserir") throw new Error("sem insert");
    expect(inserida.linha).toMatchObject({ job: "billing-reminders", ok: true });
    expect(typeof inserida.linha.started_at).toBe("string");
  });

  it("telemetria indisponível (client lança): o cron roda e responde igual, sem lançar", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await withCronRun(
      "billing-reminders",
      async () => ({ value: "ok mesmo assim", ok: true }),
      {
        client: () => {
          throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
        },
        recordEvent: async () => true,
      },
    );
    expect(out).toBe("ok mesmo assim");
    expect(aviso).toHaveBeenCalled();
  });

  it("erro ao fechar a linha não muda o resultado", async () => {
    const fake = clienteFalso({ fechamentoFalha: true });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      withCronRun("billing-reminders", async () => ({ value: 42, ok: true }), deps(fake)),
    ).resolves.toBe(42);
  });

  it("registrador de eventos que lança também não derruba o cron", async () => {
    const fake = clienteFalso();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps(fake, {
      recordEvent: (async () => {
        throw new Error("record quebrou");
      }) as never,
    });
    await expect(
      withCronRun("club-retention", async () => ({ value: 1, ok: false, failures: [{ message: "x" }] }), d),
    ).resolves.toBe(1);
  });

  it("banco pendurado: o prazo de 2 s limita a espera e o cron ainda responde", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = clienteFalso({ pendurado: true });
    const promessa = withCronRun("billing-reminders", async () => ({ value: "pronto", ok: true }), deps(fake));
    // Abertura e fechamento esperam, no máximo, um prazo cada.
    await vi.advanceTimersByTimeAsync(CRON_TELEMETRY_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(CRON_TELEMETRY_TIMEOUT_MS);
    await expect(promessa).resolves.toBe("pronto");
  });
});

describe("safeSummary", () => {
  it("devolve um objeto vazio para ausência", () => {
    expect(safeSummary(undefined)).toEqual({});
  });

  it("copia o resumo serializável", () => {
    expect(safeSummary({ a: 1, b: "x", c: { d: true } })).toEqual({ a: 1, b: "x", c: { d: true } });
  });

  it("corta resumo grande demais e tolera o que não serializa", () => {
    expect(safeSummary({ lista: "x".repeat(5_000) })).toEqual({ truncado: true });
    const circular: Record<string, unknown> = {};
    circular.eu = circular;
    expect(safeSummary(circular)).toEqual({ ilegivel: true });
    expect(safeSummary({ n: BigInt(1) })).toEqual({ ilegivel: true });
  });
});

describe("describeCronError", () => {
  it("exceção tem prioridade e sai sanitizada", () => {
    expect(describeCronError(null, new Error("falhou ana@x.com"), true)).toBe("falhou [email]");
  });

  it("erro tratado vem antes das falhas; sem nada, null", () => {
    expect(describeCronError({ error: "listagem falhou", failures: [{ message: "x" }] }, undefined, false)).toBe(
      "listagem falhou",
    );
    expect(describeCronError({ failures: [] }, undefined, false)).toBeNull();
    expect(describeCronError(null, undefined, false)).toBeNull();
  });

  it("uma falha vira a própria mensagem; várias, contagem + a primeira", () => {
    expect(describeCronError({ failures: [{ message: "só uma" }] }, undefined, false)).toBe("só uma");
    expect(describeCronError({ failures: [{ message: "a" }, { message: "b" }, { message: "c" }] }, undefined, false)).toBe(
      "3 falhas; a primeira: a",
    );
  });
});
