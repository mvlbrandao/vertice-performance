import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";
import { recordSystemEvent } from "@/lib/observability/record";
import { sanitizeMessage } from "@/lib/observability/sanitize";
import { withTimeout } from "@/lib/observability/timeout";

/**
 * Registro de cada execução de cron em cron_runs (migração 0074).
 *
 * Nasceu de um caso real: o club-retention falhou em silêncio (o DELETE do
 * clube devolveu 409 por uma FK) e a rota respondeu `ok: true`. Ninguém viu a
 * demo vazia por horas. A causa de fundo é que o resultado de um cron só
 * existia na resposta HTTP, que o agendador joga fora. Aqui o resultado vira
 * linha no banco, e a tela /admin/saude o lê.
 *
 * O wrapper abre a linha NO COMEÇO (ok = null) e a fecha no fim. Se a função
 * serverless for morta no meio (estouro de tempo, que não dá chance de
 * escrever nada), a linha fica sem `finished_at` e a tela a mostra como
 * "interrompida" — melhor sinal que existe para um cron que morreu calado.
 *
 * Regras:
 *  - NUNCA quebra o cron: toda falha de telemetria é engolida (com aviso no log).
 *  - NÃO altera o resultado: devolve exatamente o `value` que o cron produziu e,
 *    se o cron lançou, relança a MESMA exceção (o Next responde 500 como antes
 *    e o onRequestError a registra em system_events; registrar aqui também
 *    contaria a mesma falha duas vezes).
 */

export type CronJob = "billing-reminders" | "club-retention";

/** Falha tratada pelo cron (ele seguiu em frente, mas algo não funcionou). */
export interface CronFailure {
  /** Sem nome de clube nem dado pessoal: o clube vai em `clubId`. */
  message: string;
  clubId?: string | null;
}

export interface CronOutcome<T> {
  /** O que a rota devolve ao agendador (corpo da resposta). */
  value: T;
  /** false = a execução não cumpriu o que devia, mesmo sem exceção. */
  ok: boolean;
  /** Números e estados curtos. Nada de dado pessoal; vai para cron_runs.summary. */
  summary?: Record<string, unknown>;
  failures?: CronFailure[];
  /** Erro que encerrou a execução de forma tratada (ex.: não conseguiu listar os clubes). */
  error?: string | null;
}

/** Prazo de cada ida ao banco da telemetria do cron. */
export const CRON_TELEMETRY_TIMEOUT_MS = 2_000;
/** Teto de falhas viradas em system_events por execução (inclui o caso de 100 clubes falhando igual). */
const MAX_FAILURE_EVENTS = 20;
/** Resumo maior que isto é cortado: não é lugar para despejar listas. */
const MAX_SUMMARY_JSON = 4_000;

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CronRunDeps {
  client?: () => AdminClient;
  recordEvent?: typeof recordSystemEvent;
  now?: () => number;
}

/** Resumo seguro para jsonb: serializável e pequeno. */
export function safeSummary(summary: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!summary) return {};
  try {
    const json = JSON.stringify(summary);
    if (json.length > MAX_SUMMARY_JSON) return { truncado: true };
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ilegivel: true };
  }
}

/** Texto curto que resume por que a execução não foi ok (vai para cron_runs.error). */
export function describeCronError(
  outcome: { error?: string | null; failures?: CronFailure[] } | null,
  thrown: unknown,
  threw: boolean,
): string | null {
  if (threw) return sanitizeMessage(thrown);
  if (outcome?.error) return sanitizeMessage(outcome.error);
  const failures = outcome?.failures ?? [];
  if (failures.length === 0) return null;
  const first = sanitizeMessage(failures[0].message, 200);
  return failures.length === 1 ? first : `${failures.length} falhas; a primeira: ${first}`;
}

async function openRun(client: AdminClient, job: CronJob, startedAt: string): Promise<number | null> {
  try {
    const { data, error } = await withTimeout(
      client.from("cron_runs").insert({ job, started_at: startedAt }).select("id").single(),
      CRON_TELEMETRY_TIMEOUT_MS,
      "abertura da execução do cron",
    );
    if (error || !data) {
      console.warn(`[cron ${job}] execução não registrada no início:`, error?.message);
      return null;
    }
    return data.id;
  } catch (e) {
    console.warn(`[cron ${job}] execução não registrada no início:`, (e as Error)?.message);
    return null;
  }
}

/**
 * Executa `run` registrando a execução. Devolve `outcome.value`; se `run`
 * lançar, grava a falha e relança a mesma exceção.
 */
export async function withCronRun<T>(
  job: CronJob,
  run: () => Promise<CronOutcome<T>>,
  deps: CronRunDeps = {},
): Promise<T> {
  const now = deps.now ?? Date.now;
  const record = deps.recordEvent ?? recordSystemEvent;
  const startedMs = now();

  let client: AdminClient | null = null;
  let runId: number | null = null;
  try {
    client = (deps.client ?? createAdminClient)();
    runId = await openRun(client, job, new Date(startedMs).toISOString());
  } catch (e) {
    console.warn(`[cron ${job}] telemetria indisponível:`, (e as Error)?.message);
  }

  let outcome: CronOutcome<T> | null = null;
  let thrown: unknown;
  let threw = false;
  try {
    outcome = await run();
  } catch (e) {
    threw = true;
    thrown = e;
  }

  await finishRun({ client, runId, job, startedMs, finishedMs: now(), outcome, thrown, threw, record });

  if (threw) throw thrown;
  return (outcome as CronOutcome<T>).value;
}

async function finishRun<T>(input: {
  client: AdminClient | null;
  runId: number | null;
  job: CronJob;
  startedMs: number;
  finishedMs: number;
  outcome: CronOutcome<T> | null;
  thrown: unknown;
  threw: boolean;
  record: typeof recordSystemEvent;
}): Promise<void> {
  const { client, runId, job, startedMs, finishedMs, outcome, thrown, threw, record } = input;
  try {
    const failures = outcome?.failures ?? [];
    const ok = !threw && outcome?.ok !== false && failures.length === 0;
    const durationMs = Math.max(0, Math.round(finishedMs - startedMs));
    const summary = safeSummary(outcome?.summary);
    if (failures.length > 0) summary.falhas = failures.length;

    const fields = {
      finished_at: new Date(finishedMs).toISOString(),
      ok,
      duration_ms: Math.min(durationMs, 2_147_483_647),
      summary: summary as Json,
      error: describeCronError(outcome, thrown, threw),
    };

    const tasks: Promise<unknown>[] = [];

    if (client) {
      const table = client.from("cron_runs");
      // Sem o id (a abertura falhou), grava a linha inteira de uma vez: perder
      // o "começou" é aceitável, perder o resultado não é.
      const write =
        runId !== null
          ? table.update(fields).eq("id", runId)
          : table.insert({ job, started_at: new Date(startedMs).toISOString(), ...fields });
      tasks.push(
        withTimeout(write, CRON_TELEMETRY_TIMEOUT_MS, "fechamento da execução do cron")
          .then(({ error }) => {
            if (error) console.warn(`[cron ${job}] resultado não registrado:`, error.message);
          })
          .catch((e) => {
            console.warn(`[cron ${job}] resultado não registrado:`, (e as Error)?.message);
          }),
      );
    }

    // Falhas TRATADAS viram evento (as exceções chegam por onRequestError).
    for (const failure of failures.slice(0, MAX_FAILURE_EVENTS)) {
      tasks.push(
        record(
          {
            source: "cron",
            severity: "error",
            route: `/api/cron/${job}`,
            method: null,
            statusCode: null,
            durationMs: Math.min(durationMs, 2_147_483_647),
            message: failure.message,
            digest: null,
            clubId: failure.clubId ?? null,
          },
          { bypassLimiter: true },
        ),
      );
    }

    await Promise.allSettled(tasks);
  } catch (e) {
    console.warn(`[cron ${job}] telemetria do resultado falhou:`, (e as Error)?.message);
  }
}
