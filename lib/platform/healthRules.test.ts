import { describe, expect, it } from "vitest";
import {
  CONFIG_GROUPS,
  CRON_RUNNING_MAX_MS,
  CRON_STALE_AFTER_MS,
  ERRORS_24H_ATTENTION,
  ERRORS_24H_CRITICAL,
  KNOWN_CRONS,
  PROBE_OK_BELOW_MS,
  PROBE_SLOW_BELOW_MS,
  VITAL_THRESHOLDS,
  VITALS_MIN_SAMPLES_FOR_ALERT,
  buildProbeResult,
  checkConfig,
  classifyLatency,
  collectIssues,
  cronLevel,
  cronState,
  earliestRunMs,
  errorsLevel,
  fillDailySeries,
  hasPoorVitals,
  healthHref,
  isRetentionPending,
  median,
  overallLevel,
  parseDevice,
  parseWindow,
  pivotVitals,
  probeLevel,
  rateVital,
  summaryLines,
  sumDaily,
  toErrorGroupViews,
  windowDays,
  windowSince,
  worstLevel,
  type CronRunRow,
  type ErrorGroupRow,
  type ProbeResult,
  type VitalSummaryRow,
} from "./healthRules";

describe("classifyLatency", () => {
  it("ok abaixo de 300 ms, lento abaixo de 1000 ms, falha de 1000 ms para cima", () => {
    expect(PROBE_OK_BELOW_MS).toBe(300);
    expect(PROBE_SLOW_BELOW_MS).toBe(1_000);
    expect(classifyLatency(0)).toBe("ok");
    expect(classifyLatency(299)).toBe("ok");
    expect(classifyLatency(299.9)).toBe("ok");
    expect(classifyLatency(300)).toBe("lento");
    expect(classifyLatency(999)).toBe("lento");
    expect(classifyLatency(1_000)).toBe("falha");
    expect(classifyLatency(4_999)).toBe("falha");
  });

  it("valor impossível é falha", () => {
    expect(classifyLatency(Number.NaN)).toBe("falha");
    expect(classifyLatency(-1)).toBe("falha");
    expect(classifyLatency(Number.POSITIVE_INFINITY)).toBe("falha");
  });

  it("mapeia para o nível do semáforo", () => {
    expect(probeLevel("ok")).toBe("ok");
    expect(probeLevel("lento")).toBe("atencao");
    expect(probeLevel("falha")).toBe("critico");
  });
});

describe("median", () => {
  it("ímpar, par, ordem qualquer e vazio", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 40])).toBe(25);
    expect(median([5])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("não altera a lista recebida", () => {
    const lista = [3, 1, 2];
    median(lista);
    expect(lista).toEqual([3, 1, 2]);
  });
});

describe("buildProbeResult", () => {
  it("banco: classifica pela mediana e mostra o máximo", () => {
    // Uma consulta lenta entre três (conexão fria) não deixa o banco vermelho.
    const r = buildProbeResult("database", { samples: [900, 80, 90] });
    expect(r).toMatchObject({ key: "database", status: "ok", latencyMs: 90, maxMs: 900, samples: 3, detail: null });
  });

  it("mediana lenta = lento", () => {
    expect(buildProbeResult("database", { samples: [400, 450, 500] }).status).toBe("lento");
  });

  it("mediana de 1 s ou mais = falha, com explicação", () => {
    const r = buildProbeResult("auth", { samples: [1_200] });
    expect(r.status).toBe("falha");
    expect(r.detail).toContain("1 s");
  });

  it("erro devolvido é falha mesmo com amostras boas", () => {
    const r = buildProbeResult("storage", { samples: [50], error: "permission denied" });
    expect(r).toMatchObject({ status: "falha", detail: "permission denied" });
  });

  it("prazo estourado é falha e diz quanto esperou", () => {
    const r = buildProbeResult("auth", { samples: [], timedOut: true });
    expect(r).toMatchObject({ status: "falha", latencyMs: null });
    expect(r.detail).toBe("sem resposta em 5 s");
  });

  it("sem nenhuma medida é falha", () => {
    expect(buildProbeResult("database", { samples: [] }).status).toBe("falha");
    expect(buildProbeResult("database", { samples: [Number.NaN, -3] }).status).toBe("falha");
  });

  it("usa os rótulos em português", () => {
    expect(buildProbeResult("database", { samples: [10] }).label).toBe("Banco de dados");
    expect(buildProbeResult("auth", { samples: [10] }).label).toBe("Autenticação (Auth)");
    expect(buildProbeResult("storage", { samples: [10] }).label).toBe("Armazenamento (Storage)");
  });
});

describe("worstLevel", () => {
  it("pega o pior; vazio e só neutros ficam neutros", () => {
    expect(worstLevel(["ok", "atencao", "ok"])).toBe("atencao");
    expect(worstLevel(["ok", "critico", "atencao"])).toBe("critico");
    expect(worstLevel(["neutro", "ok"])).toBe("ok");
    expect(worstLevel([])).toBe("neutro");
    expect(worstLevel(["neutro"])).toBe("neutro");
  });
});

describe("janelas", () => {
  it("parseWindow: padrão 24h, aceita as três, ignora lixo e repetição", () => {
    expect(parseWindow(undefined)).toBe("24h");
    expect(parseWindow("7d")).toBe("7d");
    expect(parseWindow("30d")).toBe("30d");
    expect(parseWindow("24h")).toBe("24h");
    expect(parseWindow("90d")).toBe("24h");
    expect(parseWindow("")).toBe("24h");
    expect(parseWindow(["7d", "30d"])).toBe("7d");
    expect(parseWindow(["lixo"])).toBe("24h");
  });

  it("dias e início da janela", () => {
    expect(windowDays("24h")).toBe(1);
    expect(windowDays("7d")).toBe(7);
    expect(windowDays("30d")).toBe(30);
    const now = Date.UTC(2026, 9, 8, 15, 0, 0);
    expect(windowSince("24h", now)).toBe("2026-10-07T15:00:00.000Z");
    expect(windowSince("7d", now)).toBe("2026-10-01T15:00:00.000Z");
    expect(windowSince("30d", now)).toBe("2026-09-08T15:00:00.000Z");
  });

  it("parseDevice", () => {
    expect(parseDevice("mobile")).toBe("mobile");
    expect(parseDevice("desktop")).toBe("desktop");
    expect(parseDevice("tablet")).toBe("todos");
    expect(parseDevice(undefined)).toBe("todos");
    expect(parseDevice(["desktop", "mobile"])).toBe("desktop");
  });
});

describe("fillDailySeries / sumDaily", () => {
  const rows = [
    { day: "2026-10-06", errors: 4, warnings: 1 },
    { day: "2026-10-08", errors: 2, warnings: 0 },
  ];

  it("uma barra por dia, do início da janela até hoje, com zero nos dias vazios", () => {
    const series = fillDailySeries(rows, "2026-10-08", 3);
    expect(series.map((p) => p.day)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
    expect(series.map((p) => p.errors)).toEqual([0, 4, 0, 2]);
    expect(series.map((p) => p.warnings)).toEqual([0, 1, 0, 0]);
    expect(series.map((p) => p.isToday)).toEqual([false, false, false, true]);
  });

  it("24h cobre ontem e hoje; 30d cobre 31 datas, cruzando o mês", () => {
    expect(fillDailySeries([], "2026-10-01", 1).map((p) => p.day)).toEqual(["2026-09-30", "2026-10-01"]);
    expect(fillDailySeries([], "2026-10-08", 30)).toHaveLength(31);
  });

  it("aceita o dia como veio do banco (com hora) e números em texto", () => {
    const series = fillDailySeries(
      [{ day: "2026-10-08T00:00:00", errors: "3" as unknown as number, warnings: 0 }],
      "2026-10-08",
      0,
    );
    expect(series).toEqual([{ day: "2026-10-08", errors: 3, warnings: 0, isToday: true }]);
  });

  it("os totais somam as linhas cruas, mesmo as fora do intervalo", () => {
    expect(sumDaily([...rows, { day: "2020-01-01", errors: 10, warnings: 5 }])).toEqual({ errors: 16, warnings: 6 });
    expect(sumDaily([])).toEqual({ errors: 0, warnings: 0 });
  });
});

describe("toErrorGroupViews", () => {
  const base: ErrorGroupRow = {
    fingerprint: "abcdef0123456789abcdef0123456789",
    source: "cron",
    route: "/api/cron/club-retention",
    severity: "error",
    occurrences: 3,
    clubs_affected: 1,
    first_seen: "2026-10-08T05:30:00Z",
    last_seen: "2026-10-08T05:31:00Z",
    sample_message: "<img src=x onerror=alert(1)> falha ao apagar o clube",
    sample_digest: "123",
  };

  it("rotula a origem em português e abrevia o id", () => {
    const [view] = toErrorGroupViews([base]);
    expect(view).toMatchObject({
      id: "abcdef01",
      sourceLabel: "Rotina agendada",
      route: "/api/cron/club-retention",
      occurrences: 3,
      clubsAffected: 1,
      digest: "123",
    });
  });

  it("a mensagem passa intacta como TEXTO (quem renderiza nunca a trata como HTML)", () => {
    expect(toErrorGroupViews([base])[0].message).toBe(base.sample_message);
  });

  it("erros antes de avisos; dentro de cada um, o mais recente primeiro", () => {
    const grupos = toErrorGroupViews([
      { ...base, fingerprint: "aaaaaaaa11", severity: "warn", last_seen: "2026-10-08T10:00:00Z" },
      { ...base, fingerprint: "bbbbbbbb22", severity: "error", last_seen: "2026-10-08T06:00:00Z" },
      { ...base, fingerprint: "cccccccc33", severity: "error", last_seen: "2026-10-08T09:00:00Z" },
    ]);
    expect(grupos.map((g) => g.id)).toEqual(["cccccccc", "bbbbbbbb", "aaaaaaaa"]);
  });

  it("converte números que o banco devolve como texto (bigint)", () => {
    const [view] = toErrorGroupViews([
      { ...base, occurrences: "12" as unknown as number, clubs_affected: "2" as unknown as number },
    ]);
    expect(view.occurrences).toBe(12);
    expect(view.clubsAffected).toBe(2);
  });
});

describe("errorsLevel", () => {
  it("0 = ok, 1 a 9 = atenção, 10 ou mais = crítico", () => {
    expect(ERRORS_24H_ATTENTION).toBe(1);
    expect(ERRORS_24H_CRITICAL).toBe(10);
    expect(errorsLevel(0)).toBe("ok");
    expect(errorsLevel(1)).toBe("atencao");
    expect(errorsLevel(9)).toBe("atencao");
    expect(errorsLevel(10)).toBe("critico");
  });
});

describe("rateVital (limites oficiais)", () => {
  it("expõe os limites combinados", () => {
    expect(VITAL_THRESHOLDS).toEqual({
      LCP: { good: 2_500, poor: 4_000 },
      INP: { good: 200, poor: 500 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1_800 },
      FCP: { good: 1_800, poor: 3_000 },
    });
  });

  it.each([
    ["LCP", 2_500, "bom"],
    ["LCP", 2_501, "atencao"],
    ["LCP", 4_000, "atencao"],
    ["LCP", 4_001, "ruim"],
    ["INP", 200, "bom"],
    ["INP", 201, "atencao"],
    ["INP", 500, "atencao"],
    ["INP", 501, "ruim"],
    ["CLS", 0.1, "bom"],
    ["CLS", 0.11, "atencao"],
    ["CLS", 0.25, "atencao"],
    ["CLS", 0.26, "ruim"],
    ["TTFB", 800, "bom"],
    ["TTFB", 801, "atencao"],
    ["TTFB", 1_800, "atencao"],
    ["TTFB", 1_801, "ruim"],
    ["FCP", 1_800, "bom"],
    ["FCP", 1_801, "atencao"],
    ["FCP", 3_000, "atencao"],
    ["FCP", 3_001, "ruim"],
  ] as const)("%s com %s é %s", (metric, value, esperado) => {
    expect(rateVital(metric, value)).toBe(esperado);
  });
});

describe("pivotVitals / hasPoorVitals", () => {
  const linha = (extra: Partial<VitalSummaryRow>): VitalSummaryRow => ({
    route: "/dashboard",
    metric: "LCP",
    device: "mobile",
    samples: 50,
    p50: 1_500,
    p75: 2_200,
    p95: 5_000,
    poor_pct: 12.5,
    ...extra,
  });

  it("junta as métricas de uma rota+dispositivo e colore p50/p75/p95 cada um pelo próprio valor", () => {
    const [view] = pivotVitals([linha({}), linha({ metric: "CLS", p50: 0.01, p75: 0.12, p95: 0.4 })], "todos");
    expect(view.route).toBe("/dashboard");
    expect(view.metrics.LCP).toMatchObject({ tone: "bom", p50Tone: "bom", p95Tone: "ruim", poorPct: 12.5 });
    expect(view.metrics.CLS).toMatchObject({ tone: "atencao", p50Tone: "bom", p95Tone: "ruim" });
    expect(view.metrics.INP).toBeUndefined();
  });

  it("celular e computador da mesma rota ficam em linhas separadas (percentil não se soma)", () => {
    const views = pivotVitals([linha({}), linha({ device: "desktop", p75: 900 })], "todos");
    expect(views).toHaveLength(2);
  });

  it("filtra por dispositivo", () => {
    const rows = [linha({}), linha({ device: "desktop", route: "/admin" })];
    expect(pivotVitals(rows, "mobile").map((v) => v.route)).toEqual(["/dashboard"]);
    expect(pivotVitals(rows, "desktop").map((v) => v.route)).toEqual(["/admin"]);
  });

  it("ordena por movimento (mais amostras primeiro) e depois por rota", () => {
    const views = pivotVitals(
      [linha({ route: "/b", samples: 5 }), linha({ route: "/a", samples: 5 }), linha({ route: "/c", samples: 90 })],
      "todos",
    );
    expect(views.map((v) => v.route)).toEqual(["/c", "/a", "/b"]);
  });

  it("ignora métrica desconhecida e converte números em texto", () => {
    const views = pivotVitals(
      [linha({ metric: "FID" as never }), linha({ p75: "2600" as unknown as number, samples: "40" as unknown as number })],
      "todos",
    );
    expect(views).toHaveLength(1);
    expect(views[0].metrics.LCP).toMatchObject({ p75: 2_600, samples: 40, tone: "atencao" });
  });

  it("ruim com poucas amostras não conta para o semáforo geral", () => {
    const poucas = pivotVitals([linha({ p75: 9_000, samples: VITALS_MIN_SAMPLES_FOR_ALERT - 1 })], "todos");
    expect(hasPoorVitals(poucas)).toBe(false);
    const muitas = pivotVitals([linha({ p75: 9_000, samples: VITALS_MIN_SAMPLES_FOR_ALERT })], "todos");
    expect(hasPoorVitals(muitas)).toBe(true);
    expect(hasPoorVitals(pivotVitals([linha({})], "todos"))).toBe(false);
  });
});

describe("cronState", () => {
  const agora = Date.parse("2026-10-08T12:00:00Z");
  const run = (extra: Partial<CronRunRow>): CronRunRow => ({
    id: 1,
    job: "club-retention",
    started_at: "2026-10-08T05:30:00Z",
    finished_at: "2026-10-08T05:31:00Z",
    ok: true,
    duration_ms: 60_000,
    summary: {},
    error: null,
    ...extra,
  });

  it("sem execução registrada", () => {
    expect(cronState(null, agora)).toBe("sem_execucao");
  });

  it("sem execução, mas com prova de coleta ativa há mais de 26 h, a rotina está atrasada (não dispara)", () => {
    const haMuito = agora - CRON_STALE_AFTER_MS - 1_000;
    expect(cronState(null, agora, haMuito)).toBe("atrasado");
    // No limite exato ou antes dele (primeiro dia depois do deploy): ainda não julga.
    expect(cronState(null, agora, agora - CRON_STALE_AFTER_MS)).toBe("sem_execucao");
    expect(cronState(null, agora, agora - 3_600_000)).toBe("sem_execucao");
    // Sem nenhuma prova (nenhuma rotina registrou nada) continua neutro.
    expect(cronState(null, agora, null)).toBe("sem_execucao");
    expect(cronState(null, agora, undefined)).toBe("sem_execucao");
    expect(cronState(null, agora, Number.NaN)).toBe("sem_execucao");
  });

  it("a prova de coleta não muda o estado de quem TEM execução", () => {
    const haMuito = agora - 10 * CRON_STALE_AFTER_MS;
    expect(cronState(run({}), agora, haMuito)).toBe("ok");
    expect(cronState(run({ ok: false }), agora, haMuito)).toBe("falhou");
  });

  it("earliestRunMs: a execução mais antiga entre as listadas, ignorando datas ilegíveis", () => {
    expect(earliestRunMs([])).toBeNull();
    expect(
      earliestRunMs([
        run({ id: 1, started_at: "2026-10-07T05:30:00Z" }),
        run({ id: 2, started_at: "lixo" }),
        run({ id: 3, started_at: "2026-10-05T05:30:00Z" }),
      ]),
    ).toBe(Date.parse("2026-10-05T05:30:00Z"));
    expect(earliestRunMs([run({ started_at: "lixo" })])).toBeNull();
  });

  it("ok e recente = em dia", () => {
    expect(cronState(run({}), agora)).toBe("ok");
  });

  it("atrasado quando a última execução tem mais de 26 h", () => {
    expect(CRON_STALE_AFTER_MS).toBe(26 * 3_600_000);
    const limite = new Date(agora - CRON_STALE_AFTER_MS).toISOString();
    expect(cronState(run({ started_at: limite }), agora)).toBe("ok");
    const passou = new Date(agora - CRON_STALE_AFTER_MS - 1_000).toISOString();
    expect(cronState(run({ started_at: passou }), agora)).toBe("atrasado");
  });

  it("falhou (ok=false), mesmo velha: falha vence atraso", () => {
    expect(cronState(run({ ok: false }), agora)).toBe("falhou");
    expect(cronState(run({ ok: false, started_at: "2026-10-01T05:30:00Z" }), agora)).toBe("falhou");
    expect(cronState(run({ ok: null }), agora)).toBe("falhou");
  });

  it("aberta e recente = em execução; aberta há muito = interrompida", () => {
    expect(CRON_RUNNING_MAX_MS).toBe(15 * 60_000);
    const recente = new Date(agora - 60_000).toISOString();
    expect(cronState(run({ started_at: recente, finished_at: null, ok: null }), agora)).toBe("em_execucao");
    const velha = new Date(agora - CRON_RUNNING_MAX_MS - 1_000).toISOString();
    expect(cronState(run({ started_at: velha, finished_at: null, ok: null }), agora)).toBe("interrompida");
  });

  it("data ilegível não vira 'em dia'", () => {
    expect(cronState(run({ started_at: "lixo" }), agora)).toBe("atrasado");
  });

  it("níveis do semáforo", () => {
    expect(cronLevel("ok")).toBe("ok");
    expect(cronLevel("em_execucao")).toBe("ok");
    expect(cronLevel("atrasado")).toBe("atencao");
    expect(cronLevel("falhou")).toBe("critico");
    expect(cronLevel("interrompida")).toBe("critico");
    expect(cronLevel("sem_execucao")).toBe("neutro");
  });

  it("conhece os dois crons do vercel.json", () => {
    expect(KNOWN_CRONS.map((c) => c.job)).toEqual(["billing-reminders", "club-retention"]);
  });
});

describe("isRetentionPending", () => {
  const run = (id: number, started: string, summary: unknown): CronRunRow => ({
    id,
    job: "club-retention",
    started_at: started,
    finished_at: started,
    ok: true,
    duration_ms: 1,
    summary,
    error: null,
  });

  it("pendente quando a execução mais recente registrou retencao = 'pendente'", () => {
    expect(isRetentionPending([run(1, "2026-10-08T05:30:00Z", { retencao: "pendente" })])).toBe(true);
  });

  it("não pendente depois que a função passa a existir", () => {
    expect(
      isRetentionPending([
        run(2, "2026-10-09T05:30:00Z", { retencao: "ok" }),
        run(1, "2026-10-08T05:30:00Z", { retencao: "pendente" }),
      ]),
    ).toBe(false);
  });

  it("execução interrompida (resumo vazio) não apaga o aviso: olha a mais recente que registrou o campo", () => {
    expect(
      isRetentionPending([
        run(2, "2026-10-09T05:30:00Z", {}),
        run(1, "2026-10-08T05:30:00Z", { retencao: "pendente" }),
      ]),
    ).toBe(true);
  });

  it("sem registro, resumo estranho ou outro job: não pendente", () => {
    expect(isRetentionPending([])).toBe(false);
    expect(isRetentionPending([run(1, "2026-10-08T05:30:00Z", null)])).toBe(false);
    expect(isRetentionPending([run(1, "2026-10-08T05:30:00Z", [1])])).toBe(false);
    expect(isRetentionPending([{ ...run(1, "2026-10-08T05:30:00Z", { retencao: "pendente" }), job: "billing-reminders" }])).toBe(
      false,
    );
  });
});

describe("summaryLines", () => {
  it("mostra só chaves conhecidas, com valores simples", () => {
    const lines = summaryLines({
      apagados: 2,
      retencao: "pendente",
      demo: "ok",
      telemetriaRemovida: { system_events: 3 },
      segredo: "não aparece",
      falhas: 1,
    });
    expect(lines).toEqual([
      { label: "Clubes apagados", value: "2" },
      { label: "Retenção da telemetria", value: "pendente (função não aplicada)" },
      { label: "Demonstração", value: "recriada" },
      { label: "Falhas", value: "1" },
    ]);
  });

  it("resumo que não é objeto vira lista vazia", () => {
    expect(summaryLines(null)).toEqual([]);
    expect(summaryLines("x")).toEqual([]);
    expect(summaryLines([1, 2])).toEqual([]);
  });
});

describe("checkConfig", () => {
  const tudo: Record<string, string> = {};
  for (const group of CONFIG_GROUPS) for (const v of group.vars) tudo[v.name] = `valor-secreto-${v.name}`;

  const grupo = (env: Record<string, string | undefined>, key: string) =>
    checkConfig(env).find((g) => g.key === key)!;

  it("tudo definido = tudo ok", () => {
    expect(checkConfig(tudo).every((g) => g.level === "ok")).toBe(true);
  });

  it("só informa presença: o valor da variável nunca aparece na saída", () => {
    const saida = JSON.stringify(checkConfig(tudo));
    expect(saida).not.toContain("valor-secreto");
    for (const g of checkConfig(tudo)) for (const i of g.items) expect(typeof i.present).toBe("boolean");
  });

  it("variável obrigatória ausente = crítico", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _removida, ...resto } = tudo;
    void _removida;
    expect(grupo(resto, "supabase")).toMatchObject({ level: "critico" });
    expect(grupo({ ...tudo, CRON_SECRET: undefined }, "cron").level).toBe("critico");
    expect(grupo({ ...tudo, PLATFORM_ADMIN_EMAILS: "" }, "admin").level).toBe("critico");
  });

  it("vazia ou só espaços conta como ausente", () => {
    expect(grupo({ ...tudo, CRON_SECRET: "   " }, "cron").level).toBe("critico");
  });

  it("recomendada ausente = atenção", () => {
    expect(grupo({ ...tudo, CREDENTIALS_ENCRYPTION_KEY: undefined }, "crypto").level).toBe("atencao");
    expect(grupo({ ...tudo, ASAAS_API_KEY: undefined }, "asaas").level).toBe("atencao");
  });

  it("opcional ausente = neutro (recurso desligado, não problema)", () => {
    expect(grupo({ ...tudo, RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: undefined }, "resend").level).toBe("neutro");
    expect(grupo({ ...tudo, ASAAS_WEBHOOK_TOKEN: undefined }, "asaas").level).toBe("ok");
  });

  it("VAPID é tudo ou nada: parcial = atenção, nenhuma = neutro", () => {
    const sem = { ...tudo, NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined };
    expect(grupo(sem, "vapid").level).toBe("neutro");
    expect(grupo({ ...sem, VAPID_PRIVATE_KEY: "x" }, "vapid").level).toBe("atencao");
  });

  it("cobre as variáveis pedidas", () => {
    const nomes = CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => v.name));
    for (const esperado of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
      "PLATFORM_ADMIN_EMAILS",
      "ASAAS_API_KEY",
      "RESEND_API_KEY",
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "CREDENTIALS_ENCRYPTION_KEY",
    ]) {
      expect(nomes).toContain(esperado);
    }
  });
});

describe("collectIssues / overallLevel", () => {
  const sonda = (status: ProbeResult["status"], label = "Banco de dados"): ProbeResult => ({
    key: "database",
    label,
    status,
    latencyMs: 10,
    maxMs: 10,
    samples: 1,
    detail: null,
  });
  const configOk = checkConfig(
    Object.fromEntries(CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => [v.name, "x"]))),
  );

  const limpo = {
    probes: [sonda("ok")],
    cronStates: [{ label: "Lembretes de cobrança", state: "ok" as const }],
    errors24h: 0,
    config: configOk,
    vitalsPoor: false,
    unreadable: [] as string[],
  };

  it("tudo em ordem = nenhum problema e semáforo verde", () => {
    const issues = collectIssues(limpo);
    expect(issues).toEqual([]);
    expect(overallLevel(issues)).toBe("ok");
  });

  it("sonda lenta = atenção; sonda com falha = crítico", () => {
    expect(overallLevel(collectIssues({ ...limpo, probes: [sonda("lento")] }))).toBe("atencao");
    const issues = collectIssues({ ...limpo, probes: [sonda("falha")] });
    expect(overallLevel(issues)).toBe("critico");
    expect(issues[0].text).toBe("Banco de dados: falha");
  });

  it("cron que falhou é crítico e nomeia o cron (o caso real de 08/10)", () => {
    const issues = collectIssues({
      ...limpo,
      cronStates: [{ label: "Expurgo de clubes cancelados e demonstração", state: "falhou" }],
    });
    expect(overallLevel(issues)).toBe("critico");
    expect(issues[0].text).toBe("Expurgo de clubes cancelados e demonstração: falhou");
  });

  it("cron atrasado = atenção; sem execução ainda = não julga", () => {
    expect(overallLevel(collectIssues({ ...limpo, cronStates: [{ label: "x", state: "atrasado" }] }))).toBe("atencao");
    expect(overallLevel(collectIssues({ ...limpo, cronStates: [{ label: "x", state: "sem_execucao" }] }))).toBe("ok");
  });

  it("erros nas últimas 24 h seguem os limites", () => {
    expect(overallLevel(collectIssues({ ...limpo, errors24h: 3 }))).toBe("atencao");
    const issues = collectIssues({ ...limpo, errors24h: 12 });
    expect(overallLevel(issues)).toBe("critico");
    expect(issues[0].text).toBe("12 erros nas últimas 24 horas");
    expect(collectIssues({ ...limpo, errors24h: 1 })[0].text).toBe("1 erro nas últimas 24 horas");
  });

  it("telemetria indisponível (null) não afirma nada", () => {
    expect(collectIssues({ ...limpo, errors24h: null, cronStates: null })).toEqual([]);
  });

  it("leitura que FALHOU deixa o semáforo amarelo: sem dado não há 'tudo certo'", () => {
    const issues = collectIssues({
      ...limpo,
      errors24h: null,
      cronStates: null,
      unreadable: ["os erros do servidor", "as rotinas agendadas"],
    });
    expect(issues).toEqual([
      { level: "atencao", text: "Não foi possível ler os erros do servidor" },
      { level: "atencao", text: "Não foi possível ler as rotinas agendadas" },
    ]);
    expect(overallLevel(issues)).toBe("atencao");
    // Um problema pior continua decidindo.
    expect(overallLevel(collectIssues({ ...limpo, unreadable: ["x"], probes: [sonda("falha")] }))).toBe("critico");
  });

  it("configuração obrigatória ausente é crítico; opcional desligada não conta", () => {
    const semChave = checkConfig(
      Object.fromEntries(CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => [v.name, v.name === "CRON_SECRET" ? "" : "x"]))),
    );
    expect(overallLevel(collectIssues({ ...limpo, config: semChave }))).toBe("critico");
    const semOpcional = checkConfig(
      Object.fromEntries(
        CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => [v.name, g.key === "resend" ? "" : "x"])),
      ),
    );
    expect(overallLevel(collectIssues({ ...limpo, config: semOpcional }))).toBe("ok");
  });

  it("Web Vitals ruins pesam no máximo atenção; o pior problema decide", () => {
    expect(overallLevel(collectIssues({ ...limpo, vitalsPoor: true }))).toBe("atencao");
    expect(overallLevel(collectIssues({ ...limpo, vitalsPoor: true, probes: [sonda("falha")] }))).toBe("critico");
  });
});

describe("healthHref", () => {
  it("omite os padrões e monta a query só com o que foi escolhido", () => {
    expect(healthHref("24h", "todos")).toBe("/admin/saude");
    expect(healthHref("7d", "todos")).toBe("/admin/saude?janela=7d");
    expect(healthHref("24h", "mobile")).toBe("/admin/saude?dispositivo=mobile");
    expect(healthHref("30d", "desktop")).toBe("/admin/saude?janela=30d&dispositivo=desktop");
  });
});
