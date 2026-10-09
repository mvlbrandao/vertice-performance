import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("[supabase] SUPABASE_SERVICE_ROLE_KEY ausente no ambiente do servidor.");
  },
}));

import { criarSupabaseFalso, type Linha } from "@/lib/testing/supabaseFalso";
import {
  CRON_HISTORY,
  VITALS_MAX_ROUTES,
  loadHealth,
  readCronRuns,
  readErrorDaily,
  readErrorGroups,
  readVitalsSummary,
  runProbes,
} from "./health";
import { CONFIG_GROUPS, PROBE_TIMEOUT_MS } from "./healthRules";

const AGORA = Date.parse("2026-10-08T15:00:00Z");
const HOJE = "2026-10-08";

type Erro = { code?: string; message: string } | null;
interface Respostas {
  rpc?: Record<string, { data: unknown; error: Erro }>;
  tabelas?: Record<string, Linha[]>;
  falhasDeTabela?: string[];
  auth?: () => Promise<{ data: unknown; error: Erro }>;
  storage?: () => Promise<{ data: unknown; error: Erro }>;
  /** Substitui o from() inteiro (para devolver códigos de erro específicos). */
  from?: (tabela: string) => unknown;
}

/** Cliente composto: from() do Supabase falso + rpc, auth e storage de mentira. */
function montarCliente(r: Respostas = {}) {
  const falso = criarSupabaseFalso(r.tabelas ?? { clubs: [{ id: "c1" }] });
  for (const tabela of r.falhasDeTabela ?? []) falso.falharEm(tabela);
  const chamadasRpc: Array<{ fn: string; args: unknown }> = [];
  const client = {
    from: r.from ?? ((tabela: string) => (falso.client as unknown as { from: (t: string) => unknown }).from(tabela)),
    rpc: async (fn: string, args: unknown) => {
      chamadasRpc.push({ fn, args });
      return r.rpc?.[fn] ?? { data: [], error: null };
    },
    auth: { admin: { listUsers: r.auth ?? (async () => ({ data: { users: [] }, error: null })) } },
    storage: { listBuckets: r.storage ?? (async () => ({ data: [], error: null })) },
  } as never;
  return { client, falso, chamadasRpc };
}

/** Resolve com `valor` depois de `ms` (relógio de teste falso). */
function esperar<T>(ms: number, valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/**
 * Relógio que anda `passo` ms a cada leitura. Serve para os testes em que só
 * importa a classe "ok"; quando a latência de cada serviço importa, o teste
 * usa timers falsos e esperar().
 */
function relogio(passo: number) {
  let t = 0;
  return () => (t += passo);
}

const ENV_COMPLETO = Object.fromEntries(CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => [v.name, `segredo-${v.name}`])));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runProbes", () => {
  it("mede cada serviço no seu ritmo: banco (3 amostras, mediana e máximo), Auth e Storage (1 amostra)", async () => {
    vi.useFakeTimers();
    // Banco 100 ms por consulta (ok), Auth 450 ms (lento), Storage 1,2 s (falha).
    const { client } = montarCliente({
      from: () => ({ select: () => ({ limit: () => esperar(100, { data: [{ id: "c" }], error: null }) }) }),
      auth: () => esperar(450, { data: { users: [] }, error: null }),
      storage: () => esperar(1_200, { data: [], error: null }),
    });
    const promessa = runProbes(client, () => Date.now());
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    const [banco, auth, storage] = await promessa;

    expect(banco).toMatchObject({ key: "database", status: "ok", samples: 3, latencyMs: 100, maxMs: 100 });
    expect(auth).toMatchObject({ key: "auth", status: "lento", samples: 1, latencyMs: 450 });
    expect(storage).toMatchObject({ key: "storage", status: "falha", samples: 1, latencyMs: 1_200 });
    expect(storage.detail).toContain("acima de 1 s");
  });

  it("as sondas rodam em paralelo: a mais lenta não soma com as outras", async () => {
    vi.useFakeTimers();
    const { client } = montarCliente({
      from: () => ({ select: () => ({ limit: () => esperar(100, { data: [], error: null }) }) }),
      auth: () => esperar(100, { data: {}, error: null }),
      storage: () => esperar(100, { data: [], error: null }),
    });
    const inicio = Date.now();
    const promessa = runProbes(client, () => Date.now());
    // O banco faz 3 consultas em sequência (300 ms); se as sondas fossem em série seriam 500 ms.
    await vi.advanceTimersByTimeAsync(300);
    await promessa;
    expect(Date.now() - inicio).toBe(300);
  });

  it("erro do banco vira falha com o motivo, sem lançar", async () => {
    const { client } = montarCliente({ falhasDeTabela: ["clubs"] });
    const [banco, auth, storage] = await runProbes(client, relogio(10));
    expect(banco.status).toBe("falha");
    expect(banco.detail).toContain("falha simulada em clubs");
    expect(auth.status).toBe("ok");
    expect(storage.status).toBe("ok");
  });

  it("Auth e Storage com erro ou exceção falham sozinhos", async () => {
    const { client } = montarCliente({
      auth: async () => ({ data: null, error: { message: "Invalid API key" } }),
      storage: async () => {
        throw new Error("fetch failed");
      },
    });
    const [banco, auth, storage] = await runProbes(client, relogio(10));
    expect(banco.status).toBe("ok");
    expect(auth).toMatchObject({ status: "falha", detail: "Invalid API key" });
    expect(storage).toMatchObject({ status: "falha", detail: "fetch failed" });
  });

  it("serviço que não responde em 5 s é falha por prazo, e as outras sondas não esperam por ele", async () => {
    vi.useFakeTimers();
    const { client } = montarCliente({ storage: () => new Promise(() => {}) });
    const promessa = runProbes(client, relogio(10));
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    const [banco, , storage] = await promessa;
    expect(banco.status).toBe("ok");
    expect(storage).toMatchObject({ status: "falha", detail: "sem resposta em 5 s" });
  });

  it("sem a chave de serviço, as três ficam em falha com o motivo (não lança)", async () => {
    const probes = await runProbes(undefined);
    expect(probes).toHaveLength(3);
    expect(probes.every((p) => p.status === "falha")).toBe(true);
    expect(probes[0].detail).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("a mensagem de erro exibida sai sanitizada (sem e-mail nem token)", async () => {
    const { client } = montarCliente({
      auth: async () => ({ data: null, error: { message: "falha para ana@clube.com com token=abc123xyz" } }),
    });
    const [, auth] = await runProbes(client, relogio(10));
    expect(auth.detail).not.toContain("ana@clube.com");
    expect(auth.detail).not.toContain("abc123xyz");
  });
});

describe("leituras por função SQL", () => {
  it("passam os parâmetros certos e devolvem os dados", async () => {
    const { client, chamadasRpc } = montarCliente({
      rpc: {
        platform_error_groups: { data: [{ fingerprint: "f" }], error: null },
        platform_error_daily: { data: [{ day: "2026-10-08", errors: 1, warnings: 0 }], error: null },
        platform_vitals_summary: { data: [], error: null },
      },
    });
    expect(await readErrorGroups("2026-10-07T15:00:00.000Z", client)).toEqual({
      status: "ok",
      data: [{ fingerprint: "f" }],
    });
    expect((await readErrorDaily(7, client)).status).toBe("ok");
    expect((await readVitalsSummary("2026-10-01T00:00:00.000Z", client)).status).toBe("ok");
    expect(chamadasRpc).toEqual([
      { fn: "platform_error_groups", args: { p_since: "2026-10-07T15:00:00.000Z" } },
      { fn: "platform_error_daily", args: { p_days: 7 } },
      { fn: "platform_vitals_summary", args: { p_since: "2026-10-01T00:00:00.000Z" } },
    ]);
  });

  it("função ausente (PGRST202 / 42883) é migração pendente, não erro", async () => {
    const { client } = montarCliente({
      rpc: {
        platform_error_groups: { data: null, error: { code: "PGRST202", message: "Could not find the function" } },
        platform_error_daily: { data: null, error: { code: "42883", message: "undefined_function" } },
      },
    });
    expect(await readErrorGroups("x", client)).toEqual({ status: "migration_pending" });
    expect(await readErrorDaily(1, client)).toEqual({ status: "migration_pending" });
  });

  it("outro erro volta como erro com mensagem sanitizada", async () => {
    const { client } = montarCliente({
      rpc: { platform_vitals_summary: { data: null, error: { code: "57014", message: "timeout para ana@x.com" } } },
    });
    const r = await readVitalsSummary("x", client);
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.message).not.toContain("ana@x.com");
  });

  it("sem a chave de serviço devolve erro, não lança", async () => {
    const r = await readErrorGroups("x", undefined);
    expect(r.status).toBe("error");
  });
});

describe("readCronRuns", () => {
  const run = (id: number, job: string, started: string): Linha => ({
    id,
    job,
    started_at: started,
    finished_at: started,
    ok: true,
    duration_ms: 1,
    summary: {},
    error: null,
  });

  it("devolve as últimas execuções de cada rotina, da mais nova para a mais antiga, no máximo 5", async () => {
    const tabelas = {
      cron_runs: [
        ...Array.from({ length: 8 }, (_, i) => run(i + 1, "club-retention", `2026-10-0${i + 1}T05:30:00Z`)),
        run(100, "billing-reminders", "2026-10-07T12:00:00Z"),
        run(101, "outro-job", "2026-10-07T12:00:00Z"),
      ],
    };
    const { client } = montarCliente({ tabelas });
    const r = await readCronRuns(client);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(CRON_HISTORY).toBe(5);
    expect(r.data["club-retention"].map((x) => x.id)).toEqual([8, 7, 6, 5, 4]);
    expect(r.data["billing-reminders"].map((x) => x.id)).toEqual([100]);
    expect(r.data["outro-job"]).toBeUndefined();
  });

  it("nunca lê mais de 5 linhas por consulta (longe do corte de 1000 do PostgREST)", async () => {
    const tabelas = { cron_runs: Array.from({ length: 3_000 }, (_, i) => run(i, "club-retention", `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`)) };
    const { client, falso } = montarCliente({ tabelas });
    await readCronRuns(client);
    expect(falso.consultas.filter((c) => c.tabela === "cron_runs").every((c) => c.limite === 5)).toBe(true);
  });

  it("erro de leitura vira resultado de erro", async () => {
    const { client } = montarCliente({ tabelas: { cron_runs: [] }, falhasDeTabela: ["cron_runs"] });
    const r = await readCronRuns(client);
    expect(r.status).toBe("error");
  });

  it("tabela ausente (42P01) é migração pendente", async () => {
    const ausente = () => {
      const resposta = Promise.resolve({
        data: null,
        error: { code: "42P01", message: 'relation "public.cron_runs" does not exist' },
      });
      const builder: Record<string, unknown> = {
        then: (ok: never, ko: never) => resposta.then(ok, ko),
      };
      for (const metodo of ["select", "eq", "order", "limit"]) builder[metodo] = () => builder;
      return builder;
    };
    const { client } = montarCliente({ from: ausente });
    expect(await readCronRuns(client)).toEqual({ status: "migration_pending" });
  });
});

describe("loadHealth", () => {
  const grupo = (over: Record<string, unknown> = {}) => ({
    fingerprint: "abcdef0123456789abcdef0123456789",
    source: "cron",
    route: "/api/cron/club-retention",
    severity: "error",
    occurrences: 3,
    clubs_affected: 1,
    first_seen: "2026-10-08T05:30:00Z",
    last_seen: "2026-10-08T05:31:00Z",
    sample_message: "falha ao apagar o clube: 409",
    sample_digest: null,
    ...over,
  });

  const cronFalho: Linha = {
    id: 9,
    job: "club-retention",
    started_at: "2026-10-08T05:30:00Z",
    finished_at: "2026-10-08T05:31:00Z",
    ok: false,
    duration_ms: 60_000,
    summary: { retencao: "pendente", falhas: 1 },
    error: "falha ao apagar o clube: 409",
  };

  function cenario(extra: Partial<Respostas> = {}) {
    return montarCliente({
      tabelas: { clubs: [{ id: "c1" }], cron_runs: [cronFalho] },
      rpc: {
        platform_error_groups: { data: [grupo()], error: null },
        platform_error_daily: { data: [{ day: HOJE, errors: 3, warnings: 2 }], error: null },
        platform_vitals_summary: {
          data: [
            { route: "/dashboard", metric: "LCP", device: "mobile", samples: 50, p50: 2_000, p75: 4_500, p95: 6_000, poor_pct: 40 },
          ],
          error: null,
        },
      },
      ...extra,
    });
  }

  it("monta a visão: o cron que falhou deixa o semáforo vermelho e a retenção pendente aparece", async () => {
    const { client } = cenario();
    const s = await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });

    expect(s.overall).toBe("critico");
    expect(s.issues.map((i) => i.text)).toContain("Expurgo de clubes cancelados e demonstração: falhou");
    expect(s.retentionPending).toBe(true);

    expect(s.errors.status).toBe("ok");
    if (s.errors.status === "ok") {
      expect(s.errors.data.totals).toEqual({ errors: 3, warnings: 2 });
      expect(s.errors.data.groups[0]).toMatchObject({ id: "abcdef01", occurrences: 3, route: "/api/cron/club-retention" });
      expect(s.errors.data.daily.map((p) => p.day)).toEqual(["2026-10-07", "2026-10-08"]);
      expect(s.errors.data.truncated).toBe(false);
    }

    expect(s.crons.status).toBe("ok");
    if (s.crons.status === "ok") {
      const retencao = s.crons.data.find((c) => c.job === "club-retention")!;
      expect(retencao).toMatchObject({ state: "falhou", level: "critico" });
      expect(retencao.summary.map((l) => l.label)).toContain("Falhas");
      expect(s.crons.data.find((c) => c.job === "billing-reminders")).toMatchObject({ state: "sem_execucao", lastRun: null });
    }

    expect(s.vitals.status).toBe("ok");
    if (s.vitals.status === "ok") expect(s.vitals.data.routes[0].metrics.LCP?.tone).toBe("ruim");
  });

  it("janela 24h faz uma leitura diária; 7d lê a janela e mais as últimas 24h para o semáforo", async () => {
    const a = cenario();
    await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, client: a.client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(a.chamadasRpc.filter((c) => c.fn === "platform_error_daily").map((c) => c.args)).toEqual([{ p_days: 1 }]);

    const b = cenario();
    const s = await loadHealth({ window: "7d", device: "todos", nowMs: AGORA, today: HOJE, client: b.client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(b.chamadasRpc.filter((c) => c.fn === "platform_error_daily").map((c) => c.args)).toEqual([
      { p_days: 7 },
      { p_days: 1 },
    ]);
    expect(b.chamadasRpc.find((c) => c.fn === "platform_error_groups")?.args).toEqual({
      p_since: "2026-10-01T15:00:00.000Z",
    });
    if (s.errors.status === "ok") expect(s.errors.data.daily).toHaveLength(8);
  });

  it("filtro de dispositivo recorta as rotas de Web Vitals", async () => {
    const { client } = cenario();
    const s = await loadHealth({ window: "24h", device: "desktop", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(s.vitals.status === "ok" && s.vitals.data.routes).toEqual([]);
  });

  it("limita a lista de rotas e informa o total", async () => {
    const linhas = Array.from({ length: VITALS_MAX_ROUTES + 10 }, (_, i) => ({
      route: `/r${String(i).padStart(3, "0")}`,
      metric: "LCP",
      device: "mobile",
      samples: 5,
      p50: 1,
      p75: 1,
      p95: 1,
      poor_pct: 0,
    }));
    const { client } = montarCliente({
      tabelas: { clubs: [{ id: "c1" }], cron_runs: [] },
      rpc: { platform_vitals_summary: { data: linhas, error: null } },
    });
    const s = await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(s.vitals.status === "ok" && s.vitals.data.routes).toHaveLength(VITALS_MAX_ROUTES);
    expect(s.vitals.status === "ok" && s.vitals.data.totalRoutes).toBe(VITALS_MAX_ROUTES + 10);
  });

  it("avisa quando a lista de grupos veio cheia (cortada em 200 pela função SQL)", async () => {
    const grupos = Array.from({ length: 200 }, (_, i) => grupo({ fingerprint: `${String(i).padStart(8, "0")}${"f".repeat(24)}` }));
    const { client } = montarCliente({
      tabelas: { clubs: [{ id: "c1" }], cron_runs: [] },
      rpc: { platform_error_groups: { data: grupos, error: null } },
    });
    const s = await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(s.errors.status === "ok" && s.errors.data.truncated).toBe(true);
  });

  it("migração 0074 ausente: todas as seções de telemetria avisam, as sondas e a configuração seguem, nada lança", async () => {
    const semFuncao = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    const semTabela = () => {
      const resposta = Promise.resolve({ data: null, error: { code: "42P01", message: "relation does not exist" } });
      const builder: Record<string, unknown> = { then: (ok: never, ko: never) => resposta.then(ok, ko) };
      for (const metodo of ["select", "eq", "order", "limit"]) builder[metodo] = () => builder;
      return builder;
    };
    const { client } = montarCliente({
      rpc: {
        platform_error_groups: semFuncao,
        platform_error_daily: semFuncao,
        platform_vitals_summary: semFuncao,
      },
      from: (tabela: string) =>
        tabela === "cron_runs"
          ? semTabela()
          : { select: () => ({ limit: () => Promise.resolve({ data: [{ id: "c" }], error: null }) }) },
    });
    const s = await loadHealth({ window: "30d", device: "todos", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });

    expect(s.errors).toEqual({ status: "migration_pending" });
    expect(s.vitals).toEqual({ status: "migration_pending" });
    expect(s.crons).toEqual({ status: "migration_pending" });
    expect(s.retentionPending).toBe(false);
    expect(s.probes.every((p) => p.status === "ok")).toBe(true);
    expect(s.config.every((g) => g.level === "ok")).toBe(true);
    // Sem dado de telemetria, o semáforo não inventa problema.
    expect(s.overall).toBe("ok");
  });

  it("sem a chave de serviço a tela ainda monta: sondas em falha e leituras com erro", async () => {
    const s = await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, env: ENV_COMPLETO });
    expect(s.overall).toBe("critico");
    expect(s.probes.every((p) => p.status === "falha")).toBe(true);
    expect(s.errors.status).toBe("error");
    expect(s.crons.status).toBe("error");
  });

  it("configuração: só presença, nunca o valor", async () => {
    const { client } = cenario();
    const s = await loadHealth({ window: "24h", device: "todos", nowMs: AGORA, today: HOJE, client, env: ENV_COMPLETO, clock: relogio(20) });
    expect(JSON.stringify(s)).not.toContain("segredo-");
  });
});
