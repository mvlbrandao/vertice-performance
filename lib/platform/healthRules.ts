/**
 * Regras da tela /admin/saude: o que é "ok", "lento" ou "ruim", e como os
 * números crus do banco viram o que a tela mostra. PURO (sem "server-only",
 * sem rede, sem relógio implícito) para ser testado; as leituras de verdade
 * ficam em health.ts.
 *
 * Os limites ficam aqui, escritos e exportados, porque são decisões: mudar
 * "lento" de 300 para 500 ms altera o semáforo do dono, e isso precisa
 * aparecer numa revisão e num teste, não escondido numa tela.
 */
import type { SystemEventSource, WebVitalMetric } from "@/lib/types/database";
import { VITAL_THRESHOLDS } from "@/lib/observability/vitalsShared";
import { somaDias } from "@/lib/utils/date";

/* -------------------------------------------------------------------------- */
/* Nível comum a tudo que tem semáforo                                         */
/* -------------------------------------------------------------------------- */

/** ok = verde, atencao = amarelo, critico = vermelho, neutro = sem julgamento (ainda sem dado, recurso opcional desligado). */
export type HealthLevel = "ok" | "atencao" | "critico" | "neutro";

const LEVEL_RANK: Record<HealthLevel, number> = { neutro: 0, ok: 1, atencao: 2, critico: 3 };

/** O pior dos níveis. Lista vazia (ou só neutros) é "neutro": não há do que falar bem. */
export function worstLevel(levels: readonly HealthLevel[]): HealthLevel {
  let worst: HealthLevel = "neutro";
  for (const level of levels) if (LEVEL_RANK[level] > LEVEL_RANK[worst]) worst = level;
  return worst;
}

/* -------------------------------------------------------------------------- */
/* Sondas ao vivo                                                              */
/* -------------------------------------------------------------------------- */

/** Abaixo disto, resposta normal. */
export const PROBE_OK_BELOW_MS = 300;
/** Abaixo disto (e a partir do anterior), lento. De 1 s para cima a sonda conta como falha: para quem usa, já não carrega. */
export const PROBE_SLOW_BELOW_MS = 1_000;
/** Prazo de cada sonda; passou, é falha. */
export const PROBE_TIMEOUT_MS = 5_000;

export type ProbeStatus = "ok" | "lento" | "falha";

export function classifyLatency(ms: number): ProbeStatus {
  if (!Number.isFinite(ms) || ms < 0) return "falha";
  if (ms < PROBE_OK_BELOW_MS) return "ok";
  if (ms < PROBE_SLOW_BELOW_MS) return "lento";
  return "falha";
}

export function probeLevel(status: ProbeStatus): HealthLevel {
  return status === "ok" ? "ok" : status === "lento" ? "atencao" : "critico";
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type ProbeKey = "database" | "auth" | "storage";

export const PROBE_LABELS: Record<ProbeKey, string> = {
  database: "Banco de dados",
  auth: "Autenticação (Auth)",
  storage: "Armazenamento (Storage)",
};

export interface ProbeResult {
  key: ProbeKey;
  label: string;
  status: ProbeStatus;
  /** Mediana das medidas, em ms. null quando a sonda falhou sem medir. */
  latencyMs: number | null;
  /** Maior medida (só tem sentido com mais de uma amostra). */
  maxMs: number | null;
  samples: number;
  /** Texto curto de apoio (motivo da falha). Já sanitizado, sempre exibido como texto. */
  detail: string | null;
}

export interface ProbeOutcome {
  /** Tempos medidos, em ms, das consultas que responderam. */
  samples: readonly number[];
  /** Mensagem do erro devolvido ou lançado (será exibida: quem chama sanitiza). */
  error?: string | null;
  timedOut?: boolean;
}

/**
 * Da medida crua à sonda classificada. Erro ou prazo estourado são falha
 * mesmo que alguma amostra tenha respondido. Com várias amostras a
 * classificação usa a MEDIANA: a primeira consulta paga a abertura da
 * conexão e um pico isolado não deve pintar o painel de vermelho; o máximo
 * continua visível ao lado.
 */
export function buildProbeResult(key: ProbeKey, outcome: ProbeOutcome): ProbeResult {
  const label = PROBE_LABELS[key];
  const samples = outcome.samples.filter((ms) => Number.isFinite(ms) && ms >= 0);
  const mid = median(samples);
  const max = samples.length > 0 ? Math.max(...samples) : null;

  if (outcome.timedOut) {
    return {
      key,
      label,
      status: "falha",
      latencyMs: null,
      maxMs: max,
      samples: samples.length,
      detail: `sem resposta em ${PROBE_TIMEOUT_MS / 1000} s`,
    };
  }
  if (outcome.error) {
    return {
      key,
      label,
      status: "falha",
      latencyMs: mid,
      maxMs: max,
      samples: samples.length,
      detail: outcome.error,
    };
  }
  if (mid === null) {
    return { key, label, status: "falha", latencyMs: null, maxMs: null, samples: 0, detail: "sem medida" };
  }

  const status = classifyLatency(mid);
  return {
    key,
    label,
    status,
    latencyMs: mid,
    maxMs: max,
    samples: samples.length,
    detail: status === "falha" ? `respondeu em ${Math.round(mid)} ms, acima de ${PROBE_SLOW_BELOW_MS / 1000} s` : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Janela de tempo                                                             */
/* -------------------------------------------------------------------------- */

export const HEALTH_WINDOWS = ["24h", "7d", "30d"] as const;
export type HealthWindow = (typeof HEALTH_WINDOWS)[number];

export const WINDOW_LABELS: Record<HealthWindow, string> = {
  "24h": "24 horas",
  "7d": "7 dias",
  "30d": "30 dias",
};

/** Complemento de frase ("Erros nas últimas 24 horas"): "7 dias" e "30 dias" são masculinos, "24 horas" é feminino. */
export const WINDOW_PERIOD_LABELS: Record<HealthWindow, string> = {
  "24h": "nas últimas 24 horas",
  "7d": "nos últimos 7 dias",
  "30d": "nos últimos 30 dias",
};

const WINDOW_DAYS: Record<HealthWindow, number> = { "24h": 1, "7d": 7, "30d": 30 };

/** Padrão 24h. Valor desconhecido, repetido (`?janela=a&janela=b`) ou vazio também cai no padrão. */
export function parseWindow(raw: string | string[] | undefined): HealthWindow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (HEALTH_WINDOWS as readonly string[]).includes(value ?? "") ? (value as HealthWindow) : "24h";
}

export function windowDays(window: HealthWindow): number {
  return WINDOW_DAYS[window];
}

/** Início da janela, para platform_error_groups / platform_vitals_summary (timestamptz). */
export function windowSince(window: HealthWindow, nowMs: number): string {
  return new Date(nowMs - WINDOW_DAYS[window] * 86_400_000).toISOString();
}

export type DeviceFilter = "todos" | "mobile" | "desktop";

export const DEVICE_LABELS: Record<DeviceFilter, string> = {
  todos: "Todos",
  mobile: "Celular",
  desktop: "Computador",
};

export function parseDevice(raw: string | string[] | undefined): DeviceFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "mobile" || value === "desktop" ? value : "todos";
}

/* -------------------------------------------------------------------------- */
/* Erros: série diária e grupos                                                */
/* -------------------------------------------------------------------------- */

export interface DailyRow {
  day: string;
  errors: number;
  warnings: number;
}

export interface DailyPoint extends DailyRow {
  /** Hoje no fuso do clube: a barra de hoje é parcial e a tela a marca. */
  isToday: boolean;
}

/**
 * Uma barra por dia civil, do início da janela até hoje, com zero nos dias
 * sem registro. Sem preencher, um dia limpo sumiria do gráfico e as barras
 * vizinhas pareceriam consecutivas, escondendo justamente o "dia sem erro".
 * `days` dias para trás de hoje cobre a janela inteira (a primeira barra é
 * parcial, pois a janela começa no meio do dia).
 */
export function fillDailySeries(rows: readonly DailyRow[], today: string, days: number): DailyPoint[] {
  const byDay = new Map<string, DailyRow>();
  for (const row of rows) byDay.set(String(row.day).slice(0, 10), row);

  const points: DailyPoint[] = [];
  for (let back = days; back >= 0; back--) {
    const day = somaDias(today, -back);
    const row = byDay.get(day);
    points.push({
      day,
      errors: Number(row?.errors ?? 0),
      warnings: Number(row?.warnings ?? 0),
      isToday: back === 0,
    });
  }
  return points;
}

/** Totais do período. Somam as linhas CRUAS (não a série preenchida): nenhuma contagem se perde por cair fora do intervalo. */
export function sumDaily(rows: readonly DailyRow[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const row of rows) {
    errors += Number(row.errors) || 0;
    warnings += Number(row.warnings) || 0;
  }
  return { errors, warnings };
}

export const SOURCE_LABELS: Record<SystemEventSource, string> = {
  render: "Tela",
  route: "Rota de API",
  action: "Ação do servidor",
  proxy: "Proxy",
  cron: "Rotina agendada",
  webhook: "Webhook",
};

export interface ErrorGroupRow {
  fingerprint: string;
  source: SystemEventSource;
  route: string;
  severity: "warn" | "error";
  occurrences: number;
  clubs_affected: number;
  first_seen: string;
  last_seen: string;
  sample_message: string;
  sample_digest: string | null;
}

export interface ErrorGroupView {
  /** Início da impressão digital: chave estável para a lista e para citar o grupo. */
  id: string;
  severity: "warn" | "error";
  sourceLabel: string;
  route: string;
  occurrences: number;
  clubsAffected: number;
  firstSeen: string;
  lastSeen: string;
  /** Sempre exibir como TEXTO. Já foi sanitizada na gravação, mas nunca é HTML. */
  message: string;
  digest: string | null;
}

/** Erros antes de avisos; dentro de cada um, o mais recente primeiro. */
export function toErrorGroupViews(rows: readonly ErrorGroupRow[]): ErrorGroupView[] {
  return rows
    .map((row) => ({
      id: String(row.fingerprint).slice(0, 8),
      severity: row.severity,
      sourceLabel: SOURCE_LABELS[row.source] ?? String(row.source),
      route: row.route,
      occurrences: Number(row.occurrences) || 0,
      clubsAffected: Number(row.clubs_affected) || 0,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      message: row.sample_message,
      digest: row.sample_digest,
    }))
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
      return b.lastSeen.localeCompare(a.lastSeen);
    });
}

/** platform_error_groups devolve no máximo isto (limit 200 na função SQL): se vier cheio, a lista está cortada. */
export const ERROR_GROUPS_LIMIT = 200;

/** Erros nas últimas 24 h a partir do qual o semáforo geral sai do verde / vai ao vermelho. */
export const ERRORS_24H_ATTENTION = 1;
export const ERRORS_24H_CRITICAL = 10;

export function errorsLevel(errors24h: number): HealthLevel {
  if (errors24h >= ERRORS_24H_CRITICAL) return "critico";
  if (errors24h >= ERRORS_24H_ATTENTION) return "atencao";
  return "ok";
}

/* -------------------------------------------------------------------------- */
/* Web Vitals                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Limites oficiais (web.dev): até `good` é bom; acima de `poor` é ruim; entre
 * os dois, precisa melhorar. A avaliação oficial usa o percentil 75. A tabela
 * mora em vitalsShared, porque o servidor a usa também para calcular a nota
 * gravada; aqui ela só pinta a tela com a mesma régua.
 */
export { VITAL_THRESHOLDS };

export const VITAL_ORDER: readonly WebVitalMetric[] = ["LCP", "INP", "CLS", "TTFB", "FCP"];

export const VITAL_DESCRIPTIONS: Record<WebVitalMetric, string> = {
  LCP: "Maior elemento visível",
  INP: "Resposta ao toque/clique",
  CLS: "Estabilidade do layout",
  TTFB: "Resposta do servidor",
  FCP: "Primeiro conteúdo",
};

export type VitalTone = "bom" | "atencao" | "ruim";

export function rateVital(metric: WebVitalMetric, value: number): VitalTone {
  const { good, poor } = VITAL_THRESHOLDS[metric];
  if (value > poor) return "ruim";
  if (value > good) return "atencao";
  return "bom";
}

export function vitalLevel(tone: VitalTone): HealthLevel {
  return tone === "bom" ? "ok" : tone === "atencao" ? "atencao" : "critico";
}

/** Amostras mínimas para uma métrica ruim contar no semáforo geral: três medições ruins não são um problema da tela. */
export const VITALS_MIN_SAMPLES_FOR_ALERT = 20;

export interface VitalSummaryRow {
  route: string;
  metric: WebVitalMetric;
  device: "mobile" | "desktop";
  samples: number;
  p50: number;
  p75: number;
  p95: number;
  poor_pct: number;
}

export interface VitalCell {
  samples: number;
  p50: number;
  p75: number;
  p95: number;
  poorPct: number;
  /** Cor oficial pelo p75. */
  tone: VitalTone;
  p50Tone: VitalTone;
  p95Tone: VitalTone;
}

export interface VitalRouteView {
  route: string;
  device: "mobile" | "desktop";
  /** Maior contagem entre as métricas: ordena as rotas por movimento. */
  samples: number;
  metrics: Partial<Record<WebVitalMetric, VitalCell>>;
}

/**
 * Uma linha por rota e dispositivo, com as cinco métricas lado a lado.
 * Percentis NÃO se somam: celular e computador de uma mesma rota ficam em
 * linhas separadas em vez de um número "geral" que a conta não sustenta.
 */
export function pivotVitals(rows: readonly VitalSummaryRow[], device: DeviceFilter): VitalRouteView[] {
  const byKey = new Map<string, VitalRouteView>();

  for (const row of rows) {
    if (device !== "todos" && row.device !== device) continue;
    if (!(row.metric in VITAL_THRESHOLDS)) continue;

    const key = `${row.route}|${row.device}`;
    let view = byKey.get(key);
    if (!view) {
      view = { route: row.route, device: row.device, samples: 0, metrics: {} };
      byKey.set(key, view);
    }

    const p50 = Number(row.p50);
    const p75 = Number(row.p75);
    const p95 = Number(row.p95);
    const samples = Number(row.samples) || 0;
    view.metrics[row.metric] = {
      samples,
      p50,
      p75,
      p95,
      poorPct: Number(row.poor_pct) || 0,
      tone: rateVital(row.metric, p75),
      p50Tone: rateVital(row.metric, p50),
      p95Tone: rateVital(row.metric, p95),
    };
    view.samples = Math.max(view.samples, samples);
  }

  return [...byKey.values()].sort(
    (a, b) => b.samples - a.samples || a.route.localeCompare(b.route) || a.device.localeCompare(b.device),
  );
}

/** Alguma métrica com amostra suficiente está ruim no p75? */
export function hasPoorVitals(views: readonly VitalRouteView[]): boolean {
  return views.some((view) =>
    Object.values(view.metrics).some(
      (cell) => cell !== undefined && cell.samples >= VITALS_MIN_SAMPLES_FOR_ALERT && cell.tone === "ruim",
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Rotinas agendadas (cron_runs)                                               */
/* -------------------------------------------------------------------------- */

/** Rotinas diárias: mais de 26 h sem rodar é atraso (24 h + folga para o agendador atrasar). */
export const CRON_STALE_AFTER_MS = 26 * 3_600_000;
/** Uma execução aberta há mais que isto morreu no meio (a função serverless foi encerrada). */
export const CRON_RUNNING_MAX_MS = 15 * 60_000;

export interface KnownCron {
  job: string;
  label: string;
  /** Texto do agendamento (vercel.json), no horário de Brasília. */
  schedule: string;
}

export const KNOWN_CRONS: readonly KnownCron[] = [
  { job: "billing-reminders", label: "Lembretes de cobrança", schedule: "todo dia, 09h (Brasília)" },
  { job: "club-retention", label: "Expurgo de clubes cancelados e demonstração", schedule: "todo dia, 02h30 (Brasília)" },
];

export interface CronRunRow {
  id: number;
  job: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  duration_ms: number | null;
  summary: unknown;
  error: string | null;
}

export type CronState = "ok" | "atrasado" | "falhou" | "interrompida" | "em_execucao" | "sem_execucao";

export const CRON_STATE_LABELS: Record<CronState, string> = {
  ok: "Em dia",
  atrasado: "Atrasado",
  falhou: "Falhou",
  interrompida: "Interrompida",
  em_execucao: "Em execução",
  sem_execucao: "Sem execuções",
};

/**
 * Estado da ÚLTIMA execução. Falha vem antes de atraso: um cron que falhou
 * ontem de manhã também está "atrasado", mas o que o dono precisa saber é que
 * falhou.
 *
 * Sem nenhuma execução, o estado depende de haver prova de que a coleta já
 * existe há tempo: `collectingSinceMs` é o início da execução mais antiga que
 * ALGUMA rotina conhecida registrou. Se ela é mais velha que o intervalo
 * diário e esta rotina nunca apareceu, ela não está disparando (desativada no
 * projeto, caminho errado no vercel.json): "atrasado", e não o neutro "sem
 * execuções", que valeria para sempre e deixaria o semáforo verde. Sem essa
 * prova (primeiro dia depois do deploy) continua neutro, para não acusar
 * atraso de quem simplesmente ainda não teve o primeiro horário.
 */
export function cronState(run: CronRunRow | null, nowMs: number, collectingSinceMs?: number | null): CronState {
  if (!run) {
    const evidence = typeof collectingSinceMs === "number" && Number.isFinite(collectingSinceMs);
    return evidence && nowMs - collectingSinceMs > CRON_STALE_AFTER_MS ? "atrasado" : "sem_execucao";
  }
  const startedMs = Date.parse(run.started_at);
  const age = Number.isFinite(startedMs) ? nowMs - startedMs : Number.POSITIVE_INFINITY;

  if (run.finished_at === null) return age > CRON_RUNNING_MAX_MS ? "interrompida" : "em_execucao";
  if (run.ok !== true) return "falhou";
  return age > CRON_STALE_AFTER_MS ? "atrasado" : "ok";
}

/** Início da execução mais antiga entre as listadas, ou null se não há nenhuma. */
export function earliestRunMs(runs: readonly CronRunRow[]): number | null {
  let earliest: number | null = null;
  for (const run of runs) {
    const ms = Date.parse(run.started_at);
    if (Number.isFinite(ms) && (earliest === null || ms < earliest)) earliest = ms;
  }
  return earliest;
}

export function cronLevel(state: CronState): HealthLevel {
  switch (state) {
    case "ok":
    case "em_execucao":
      return "ok";
    case "atrasado":
      return "atencao";
    case "falhou":
    case "interrompida":
      return "critico";
    case "sem_execucao":
      return "neutro";
  }
}

/** Chaves de cron_runs.summary que a tela sabe nomear (o jsonb é livre; o resto é ignorado). */
const SUMMARY_LABELS: Record<string, string> = {
  enviados: "Lembretes enviados",
  clubesVencidos: "Clubes com prazo vencido",
  apagados: "Clubes apagados",
  arquivosContrato: "Contratos removidos do storage",
  retencaoDias: "Prazo de retenção (dias)",
  retencao: "Retenção da telemetria",
  demo: "Demonstração",
  falhas: "Falhas",
};

const SUMMARY_VALUE_LABELS: Record<string, Record<string, string>> = {
  retencao: { ok: "ok", pendente: "pendente (função não aplicada)", falhou: "falhou" },
  demo: { ok: "recriada", falhou: "falhou" },
};

export interface SummaryLine {
  label: string;
  value: string;
}

/** Resumo da execução em linhas legíveis. Só chaves conhecidas e valores simples: o jsonb é livre e não vira HTML nem despejo. */
export function summaryLines(summary: unknown): SummaryLine[] {
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) return [];
  const lines: SummaryLine[] = [];
  for (const [key, label] of Object.entries(SUMMARY_LABELS)) {
    const value = (summary as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      lines.push({ label, value: String(value) });
    } else if (typeof value === "string") {
      lines.push({ label, value: SUMMARY_VALUE_LABELS[key]?.[value] ?? value.slice(0, 80) });
    }
  }
  return lines;
}

/**
 * A retenção da telemetria está pendente? Olha a execução mais recente do
 * club-retention que registrou o campo `retencao`. Não basta a última linha:
 * uma execução interrompida tem resumo vazio e faria o aviso sumir enquanto a
 * função continua sem existir.
 */
export function isRetentionPending(runs: readonly CronRunRow[]): boolean {
  const ordered = [...runs]
    .filter((run) => run.job === "club-retention")
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  for (const run of ordered) {
    if (typeof run.summary === "object" && run.summary !== null && !Array.isArray(run.summary)) {
      const value = (run.summary as Record<string, unknown>).retencao;
      if (typeof value === "string") return value === "pendente";
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Configuração (só presença, nunca valor)                                     */
/* -------------------------------------------------------------------------- */

/**
 * required: sem ela uma parte central não funciona (ausente = crítico).
 * recommended: o recurso existe em produção e vai falhar sem ela (ausente = atenção).
 * optional: só liga/desliga um recurso (ausente = informativo).
 */
export type ConfigImportance = "required" | "recommended" | "optional";

interface ConfigVarSpec {
  name: string;
  importance: ConfigImportance;
}

interface ConfigGroupSpec {
  key: string;
  label: string;
  /** Tudo ou nada: ter só parte das variáveis é configuração quebrada. */
  allOrNothing?: boolean;
  vars: readonly ConfigVarSpec[];
}

export const CONFIG_GROUPS: readonly ConfigGroupSpec[] = [
  {
    key: "supabase",
    label: "Banco e autenticação (Supabase)",
    vars: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", importance: "required" },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", importance: "required" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", importance: "required" },
    ],
  },
  {
    key: "admin",
    label: "Administração da plataforma",
    vars: [{ name: "PLATFORM_ADMIN_EMAILS", importance: "required" }],
  },
  {
    key: "cron",
    label: "Rotinas agendadas",
    vars: [{ name: "CRON_SECRET", importance: "required" }],
  },
  {
    key: "crypto",
    label: "Cifra das credenciais dos clubes",
    vars: [{ name: "CREDENTIALS_ENCRYPTION_KEY", importance: "recommended" }],
  },
  {
    key: "asaas",
    label: "Cobrança (Asaas)",
    vars: [
      { name: "ASAAS_API_KEY", importance: "recommended" },
      { name: "ASAAS_PLATFORM_WEBHOOK_TOKEN", importance: "recommended" },
      { name: "ASAAS_WITHDRAW_WEBHOOK_TOKEN", importance: "recommended" },
      { name: "ASAAS_WEBHOOK_TOKEN", importance: "optional" },
      { name: "ASAAS_API_BASE_URL", importance: "optional" },
    ],
  },
  {
    key: "resend",
    label: "E-mail (Resend)",
    vars: [
      { name: "RESEND_API_KEY", importance: "optional" },
      { name: "RESEND_FROM_EMAIL", importance: "optional" },
    ],
  },
  {
    key: "vapid",
    label: "Notificações push (VAPID)",
    allOrNothing: true,
    vars: [
      { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", importance: "optional" },
      { name: "VAPID_PRIVATE_KEY", importance: "optional" },
      { name: "VAPID_SUBJECT", importance: "optional" },
    ],
  },
];

export interface ConfigItemView {
  name: string;
  importance: ConfigImportance;
  present: boolean;
}

export interface ConfigGroupView {
  key: string;
  label: string;
  level: HealthLevel;
  /** Frase curta do que o estado significa. */
  summary: string;
  items: ConfigItemView[];
}

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Presença das variáveis de ambiente. Devolve SÓ nomes e booleanos: o valor
 * de uma variável nunca atravessa esta função (nem para o log nem para a
 * tela). O teste confere isso procurando o valor na saída serializada.
 */
export function checkConfig(env: Readonly<Record<string, string | undefined>>): ConfigGroupView[] {
  return CONFIG_GROUPS.map((group) => {
    const items: ConfigItemView[] = group.vars.map((spec) => ({
      name: spec.name,
      importance: spec.importance,
      present: isPresent(env[spec.name]),
    }));
    const missing = items.filter((item) => !item.present);
    const presentCount = items.length - missing.length;

    let level: HealthLevel;
    let summary: string;
    if (missing.length === 0) {
      level = "ok";
      summary = "Configurado";
    } else if (missing.some((item) => item.importance === "required")) {
      level = "critico";
      summary = "Falta uma variável obrigatória";
    } else if (group.allOrNothing && presentCount > 0) {
      level = "atencao";
      summary = "Configuração incompleta: defina todas ou nenhuma";
    } else if (missing.some((item) => item.importance === "recommended")) {
      level = "atencao";
      summary = "Falta uma variável recomendada";
    } else if (presentCount === 0) {
      level = "neutro";
      summary = "Não configurado (recurso desligado)";
    } else {
      // Só faltam itens opcionais e o recurso está em uso: não é problema.
      level = "ok";
      summary = "Configurado (itens opcionais ausentes)";
    }
    return { key: group.key, label: group.label, level, summary, items };
  });
}

/* -------------------------------------------------------------------------- */
/* Semáforo geral                                                              */
/* -------------------------------------------------------------------------- */

export interface HealthIssue {
  level: Exclude<HealthLevel, "ok" | "neutro">;
  text: string;
}

export interface OverallInput {
  probes: readonly ProbeResult[];
  /** null = não deu para ler (migração ausente ou erro): não afirma nada. */
  cronStates: ReadonlyArray<{ label: string; state: CronState }> | null;
  errors24h: number | null;
  config: readonly ConfigGroupView[];
  vitalsPoor: boolean;
  /**
   * Leituras que FALHARAM de verdade (erro, não "migração pendente", que é
   * intencional). Sem dado, o semáforo não pode dizer "tudo certo": justamente
   * quando o banco engasga é que a tela de saúde não pode ficar verde.
   */
  unreadable: readonly string[];
}

function plural(count: number, singular: string, pluralText: string): string {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

/** Tudo que está fora do verde, em frases para o cabeçalho. */
export function collectIssues(input: OverallInput): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const probe of input.probes) {
    if (probe.status === "falha") issues.push({ level: "critico", text: `${probe.label}: falha` });
    else if (probe.status === "lento") issues.push({ level: "atencao", text: `${probe.label}: lento` });
  }

  for (const cron of input.cronStates ?? []) {
    const level = cronLevel(cron.state);
    if (level === "critico" || level === "atencao") {
      issues.push({ level, text: `${cron.label}: ${CRON_STATE_LABELS[cron.state].toLowerCase()}` });
    }
  }

  if (input.errors24h !== null) {
    const level = errorsLevel(input.errors24h);
    if (level === "critico" || level === "atencao") {
      issues.push({
        level,
        text: `${plural(input.errors24h, "erro", "erros")} nas últimas 24 horas`,
      });
    }
  }

  for (const what of input.unreadable) {
    issues.push({ level: "atencao", text: `Não foi possível ler ${what}` });
  }

  for (const group of input.config) {
    if (group.level === "critico" || group.level === "atencao") {
      issues.push({ level: group.level, text: `${group.label}: ${group.summary.toLowerCase()}` });
    }
  }

  if (input.vitalsPoor) {
    issues.push({ level: "atencao", text: "Desempenho no navegador ruim em alguma tela (Web Vitals)" });
  }

  return issues;
}

export function overallLevel(issues: readonly HealthIssue[]): HealthLevel {
  return issues.length === 0 ? "ok" : worstLevel(issues.map((issue) => issue.level));
}

/* -------------------------------------------------------------------------- */
/* Endereços da tela                                                           */
/* -------------------------------------------------------------------------- */

/** URL da tela com o filtro escolhido. Os padrões (24h, todos) ficam de fora para o endereço sair limpo. */
export function healthHref(window: HealthWindow, device: DeviceFilter): string {
  const params = new URLSearchParams();
  if (window !== "24h") params.set("janela", window);
  if (device !== "todos") params.set("dispositivo", device);
  const query = params.toString();
  return query === "" ? "/admin/saude" : `/admin/saude?${query}`;
}
