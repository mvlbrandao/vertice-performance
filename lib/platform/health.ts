import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/platform/contracts";
import { isMissingFunction } from "@/lib/observability/prune";
import { sanitizeMessage } from "@/lib/observability/sanitize";
import { TimeoutError, withTimeout } from "@/lib/observability/timeout";
import { hojeISO } from "@/lib/utils/date";
import {
  ERROR_GROUPS_LIMIT,
  KNOWN_CRONS,
  PROBE_TIMEOUT_MS,
  buildProbeResult,
  checkConfig,
  collectIssues,
  cronLevel,
  cronState,
  fillDailySeries,
  hasPoorVitals,
  isRetentionPending,
  overallLevel,
  pivotVitals,
  summaryLines,
  sumDaily,
  toErrorGroupViews,
  windowDays,
  windowSince,
  type ConfigGroupView,
  type CronRunRow,
  type CronState,
  type DailyPoint,
  type DailyRow,
  type DeviceFilter,
  type ErrorGroupRow,
  type ErrorGroupView,
  type HealthIssue,
  type HealthLevel,
  type HealthWindow,
  type KnownCron,
  type ProbeKey,
  type ProbeResult,
  type SummaryLine,
  type VitalRouteView,
  type VitalSummaryRow,
} from "@/lib/platform/healthRules";

/**
 * Leituras e sondas da tela /admin/saude. Só roda no servidor, DEPOIS de
 * requirePlatformAdmin(), com a service role (as tabelas e funções de
 * telemetria não têm política para ninguém mais).
 *
 * Desenho: esta tela existe para mostrar o que está QUEBRADO, então ela não
 * pode quebrar junto. Cada leitura devolve um resultado tipado (ok, migração
 * pendente ou erro) em vez de lançar, cada uma tem prazo, e uma sonda com
 * falha é um resultado, não uma exceção. Um pedaço fora do ar vira um cartão
 * vermelho; o resto da página continua.
 *
 * Nada aqui soma nem conta no Node sobre select sem paginação (o PostgREST
 * corta em 1000 linhas): as contagens vêm das funções SQL platform_*, e a
 * única leitura direta (cron_runs) pede 5 linhas por rotina.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** Prazo das leituras de telemetria. Maior que o das sondas: agregar 30 dias custa mais que um ping. */
export const READ_TIMEOUT_MS = 8_000;
/** Quantas execuções recentes de cada rotina a tela mostra. */
export const CRON_HISTORY = 5;
/** Quantas rotas de Web Vitals a tela lista (as mais movimentadas). */
export const VITALS_MAX_ROUTES = 25;

export type ReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "migration_pending" }
  | { status: "error"; message: string };

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

function toReadError(error: PostgrestErrorLike): ReadResult<never> {
  // Tabela ou função ainda não criada: aviso de migração, não erro.
  if (isMissingRelation(error as never) || isMissingFunction(error)) return { status: "migration_pending" };
  return { status: "error", message: sanitizeMessage(error.message ?? "erro desconhecido", 200) };
}

async function guarded<T>(
  label: string,
  work: () => PromiseLike<{ data: T | null; error: PostgrestErrorLike | null }>,
): Promise<ReadResult<T>> {
  try {
    const { data, error } = await withTimeout(work(), READ_TIMEOUT_MS, label);
    if (error) return toReadError(error);
    return { status: "ok", data: (data ?? ([] as unknown)) as T };
  } catch (e) {
    return toReadError({ message: e instanceof Error ? e.message : String(e) });
  }
}

/* -------------------------------------------------------------------------- */
/* Sondas ao vivo                                                              */
/* -------------------------------------------------------------------------- */

const DB_PROBE_QUERIES = 3;

type Clock = () => number;
const defaultClock: Clock = () => performance.now();

async function runProbe(
  key: ProbeKey,
  measure: (record: (ms: number) => void) => Promise<void>,
): Promise<ProbeResult> {
  const samples: number[] = [];
  try {
    await withTimeout(measure((ms) => samples.push(ms)), PROBE_TIMEOUT_MS, `sonda ${key}`);
    return buildProbeResult(key, { samples });
  } catch (e) {
    if (e instanceof TimeoutError) return buildProbeResult(key, { samples, timedOut: true });
    return buildProbeResult(key, {
      samples,
      error: sanitizeMessage(e instanceof Error ? e.message : String(e), 160),
    });
  }
}

/** Mede uma ida ao serviço e lança se ele devolveu erro (um erro rápido não é "ok"). */
async function timeOnce(
  clock: Clock,
  call: () => PromiseLike<{ error: { message?: string } | null }>,
): Promise<number> {
  const start = clock();
  const { error } = await call();
  const elapsed = clock() - start;
  if (error) throw new Error(error.message ?? "erro desconhecido");
  return elapsed;
}

/**
 * Banco, Auth e Storage, em paralelo, cada um com prazo de 5 s. O banco faz 3
 * consultas pequenas em sequência (mediana e máximo); Auth e Storage, uma.
 */
export async function runProbes(client?: AdminClient, clock: Clock = defaultClock): Promise<ProbeResult[]> {
  let admin: AdminClient;
  try {
    admin = client ?? createAdminClient();
  } catch (e) {
    // Sem a chave de serviço nenhuma sonda roda: as três ficam vermelhas, com o motivo.
    const error = sanitizeMessage(e instanceof Error ? e.message : String(e), 160);
    return (["database", "auth", "storage"] as const).map((key) => buildProbeResult(key, { samples: [], error }));
  }

  return Promise.all([
    runProbe("database", async (record) => {
      for (let i = 0; i < DB_PROBE_QUERIES; i++) {
        record(await timeOnce(clock, () => admin.from("clubs").select("id").limit(1)));
      }
    }),
    runProbe("auth", async (record) => {
      record(await timeOnce(clock, () => admin.auth.admin.listUsers({ page: 1, perPage: 1 })));
    }),
    runProbe("storage", async (record) => {
      record(await timeOnce(clock, () => admin.storage.listBuckets()));
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Leituras de telemetria                                                      */
/* -------------------------------------------------------------------------- */

export function readErrorGroups(since: string, client?: AdminClient): Promise<ReadResult<ErrorGroupRow[]>> {
  return guarded("erros agrupados", () =>
    (client ?? createAdminClient()).rpc("platform_error_groups", { p_since: since }),
  );
}

export function readErrorDaily(days: number, client?: AdminClient): Promise<ReadResult<DailyRow[]>> {
  return guarded("série diária de erros", () =>
    (client ?? createAdminClient()).rpc("platform_error_daily", { p_days: days }),
  );
}

export function readVitalsSummary(since: string, client?: AdminClient): Promise<ReadResult<VitalSummaryRow[]>> {
  return guarded("Web Vitals", () =>
    (client ?? createAdminClient()).rpc("platform_vitals_summary", { p_since: since }),
  );
}

/** Últimas execuções de cada rotina conhecida, da mais nova para a mais antiga. */
export async function readCronRuns(client?: AdminClient): Promise<ReadResult<Record<string, CronRunRow[]>>> {
  let admin: AdminClient;
  try {
    admin = client ?? createAdminClient();
  } catch (e) {
    return { status: "error", message: sanitizeMessage(e instanceof Error ? e.message : String(e), 200) };
  }

  const results = await Promise.all(
    KNOWN_CRONS.map(async (cron) => ({
      job: cron.job,
      result: await guarded<CronRunRow[]>("execuções do cron", () =>
        admin
          .from("cron_runs")
          .select("id, job, started_at, finished_at, ok, duration_ms, summary, error")
          .eq("job", cron.job)
          .order("started_at", { ascending: false })
          .limit(CRON_HISTORY),
      ),
    })),
  );

  const byJob: Record<string, CronRunRow[]> = {};
  for (const { job, result } of results) {
    if (result.status === "migration_pending") return result;
    if (result.status === "error") return result;
    byJob[job] = result.data;
  }
  return { status: "ok", data: byJob };
}

/* -------------------------------------------------------------------------- */
/* Visão consolidada                                                           */
/* -------------------------------------------------------------------------- */

export interface ErrorsView {
  groups: ErrorGroupView[];
  daily: DailyPoint[];
  totals: { errors: number; warnings: number };
  /** A função SQL devolve no máximo 200 grupos: se veio cheia, a lista está cortada. */
  truncated: boolean;
}

export interface CronView extends KnownCron {
  state: CronState;
  level: HealthLevel;
  lastRun: CronRunRow | null;
  /** Mais nova primeiro, inclusive a última. */
  recent: CronRunRow[];
  summary: SummaryLine[];
}

export interface HealthSnapshot {
  window: HealthWindow;
  device: DeviceFilter;
  generatedAt: string;
  probes: ProbeResult[];
  errors: ReadResult<ErrorsView>;
  vitals: ReadResult<{ routes: VitalRouteView[]; totalRoutes: number }>;
  crons: ReadResult<CronView[]>;
  retentionPending: boolean;
  config: ConfigGroupView[];
  issues: HealthIssue[];
  overall: HealthLevel;
}

export interface LoadHealthOptions {
  window: HealthWindow;
  device: DeviceFilter;
  nowMs?: number;
  /** Data civil de hoje (America/Sao_Paulo); injetável nos testes. */
  today?: string;
  client?: AdminClient;
  env?: Readonly<Record<string, string | undefined>>;
  clock?: Clock;
}

export async function loadHealth(options: LoadHealthOptions): Promise<HealthSnapshot> {
  const nowMs = options.nowMs ?? Date.now();
  const today = options.today ?? hojeISO();
  const { window, device } = options;
  const days = windowDays(window);
  const since = windowSince(window, nowMs);

  let client = options.client;
  if (!client) {
    try {
      client = createAdminClient();
    } catch {
      // Segue sem client: cada leitura tenta criar o seu e devolve o próprio erro.
      client = undefined;
    }
  }

  // O semáforo olha SEMPRE as últimas 24 h, qualquer que seja a janela escolhida.
  const [probes, groupsRead, dailyRead, daily24Read, vitalsRead, cronsRead] = await Promise.all([
    runProbes(client, options.clock),
    readErrorGroups(since, client),
    readErrorDaily(days, client),
    window === "24h" ? Promise.resolve(null) : readErrorDaily(1, client),
    readVitalsSummary(since, client),
    readCronRuns(client),
  ]);

  // Erros: precisam das duas leituras (grupos e série) para fazer sentido juntas.
  let errors: ReadResult<ErrorsView>;
  if (groupsRead.status === "ok" && dailyRead.status === "ok") {
    errors = {
      status: "ok",
      data: {
        groups: toErrorGroupViews(groupsRead.data),
        daily: fillDailySeries(dailyRead.data, today, days),
        totals: sumDaily(dailyRead.data),
        truncated: groupsRead.data.length >= ERROR_GROUPS_LIMIT,
      },
    };
  } else if (groupsRead.status === "migration_pending" || dailyRead.status === "migration_pending") {
    errors = { status: "migration_pending" };
  } else {
    const failed = groupsRead.status === "error" ? groupsRead : dailyRead;
    errors = failed.status === "error" ? failed : { status: "error", message: "leitura indisponível" };
  }

  let errors24h: number | null = null;
  const daily24 = window === "24h" ? dailyRead : daily24Read;
  if (daily24 && daily24.status === "ok") errors24h = sumDaily(daily24.data).errors;

  let vitals: HealthSnapshot["vitals"];
  let vitalsPoor = false;
  if (vitalsRead.status === "ok") {
    const all = pivotVitals(vitalsRead.data, device);
    vitalsPoor = hasPoorVitals(all);
    vitals = { status: "ok", data: { routes: all.slice(0, VITALS_MAX_ROUTES), totalRoutes: all.length } };
  } else {
    vitals = vitalsRead;
  }

  let crons: HealthSnapshot["crons"];
  let retentionPending = false;
  if (cronsRead.status === "ok") {
    const views: CronView[] = KNOWN_CRONS.map((cron) => {
      const recent = cronsRead.data[cron.job] ?? [];
      const lastRun = recent[0] ?? null;
      const state = cronState(lastRun, nowMs);
      return {
        ...cron,
        state,
        level: cronLevel(state),
        lastRun,
        recent,
        summary: summaryLines(lastRun?.summary),
      };
    });
    crons = { status: "ok", data: views };
    retentionPending = isRetentionPending(Object.values(cronsRead.data).flat());
  } else {
    crons = cronsRead;
  }

  const config = checkConfig(options.env ?? process.env);

  const issues = collectIssues({
    probes,
    cronStates: crons.status === "ok" ? crons.data.map((c) => ({ label: c.label, state: c.state })) : null,
    errors24h,
    config,
    vitalsPoor,
  });

  return {
    window,
    device,
    generatedAt: new Date(nowMs).toISOString(),
    probes,
    errors,
    vitals,
    crons,
    retentionPending,
    config,
    issues,
    overall: overallLevel(issues),
  };
}
