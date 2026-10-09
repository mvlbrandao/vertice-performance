/**
 * Parte dos Web Vitals que roda TAMBÉM no navegador. Sem zod, sem Node, sem
 * nada de servidor: entra no pacote que cada pessoa baixa, então fica pequena.
 */

export const VITAL_METRICS = ["LCP", "INP", "CLS", "TTFB", "FCP"] as const;
export type VitalMetricName = (typeof VITAL_METRICS)[number];

export const VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type VitalRating = (typeof VITAL_RATINGS)[number];

export const VITALS_ENDPOINT = "/api/telemetry/vitals";

/** Quantas métricas cabem num envio: uma de cada (LCP, INP, CLS, TTFB, FCP). */
export const VITALS_MAX_PER_BATCH = VITAL_METRICS.length;

/**
 * Limites oficiais (web.dev): até `good` é bom; acima de `poor` é ruim; entre
 * os dois, precisa melhorar. Ficam aqui, e não na tela de saúde, porque o
 * SERVIDOR também os usa para calcular o `rating` gravado: o que o navegador
 * diz sobre a própria nota não é de confiança (um valor de 100 s marcado como
 * "good" iria direto para o poor_pct da tela do dono).
 */
export const VITAL_THRESHOLDS: Record<VitalMetricName, { good: number; poor: number }> = {
  LCP: { good: 2_500, poor: 4_000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1_800 },
  FCP: { good: 1_800, poor: 3_000 },
};

/** Mesma regra da biblioteca web-vitals: acima de `poor` é ruim, acima de `good` precisa melhorar. */
export function ratingFor(name: VitalMetricName, value: number): VitalRating {
  const { good, poor } = VITAL_THRESHOLDS[name];
  return value > poor ? "poor" : value > good ? "needs-improvement" : "good";
}

export function isVitalMetric(name: unknown): name is VitalMetricName {
  return typeof name === "string" && (VITAL_METRICS as readonly string[]).includes(name);
}

/**
 * Taxa de amostragem de NEXT_PUBLIC_VITALS_SAMPLE_RATE: número entre 0 e 1.
 * Ausente, vazia ou ilegível = 1 (mede todo mundo): o sistema tem poucos
 * clubes e uma amostra pequena não diz nada; reduzir é decisão consciente.
 * Fora da faixa é recortado (150% vira 1, -1 vira 0). Aceita vírgula decimal
 * ("0,5") porque a variável é digitada à mão no painel da Vercel.
 */
export function parseSampleRate(raw: string | null | undefined): number {
  if (raw === undefined || raw === null) return 1;
  const text = raw.trim().replace(",", ".");
  if (text === "") return 1;
  const value = Number(text);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Sorteio de amostragem. `random` injetável para o teste ser determinístico. */
export function shouldSample(rate: number, random: () => number = Math.random): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return random() < rate;
}

export interface VitalReport {
  name: VitalMetricName;
  value: number;
  navigationType?: string;
  route: string;
}

/** Corpo de UM envio: as métricas de uma página, juntas. */
export interface VitalsBatch {
  metrics: VitalReport[];
}

/**
 * Relatório de uma métrica do Next (`useReportWebVitals`). Devolve null para o
 * que não nos interessa (FID, métricas internas do Next) ou que veio inválido.
 * A rota vai como o navegador a vê, SEM query string: o servidor normaliza de
 * novo, mas não há motivo para mandar token pela rede. A nota (`rating`) não
 * viaja: o servidor a recalcula a partir de nome e valor.
 */
export function buildVitalReport(
  metric: { name: string; value: number; navigationType?: string },
  pathname: string,
): VitalReport | null {
  if (!isVitalMetric(metric.name)) return null;
  if (!Number.isFinite(metric.value) || metric.value < 0) return null;

  const report: VitalReport = {
    name: metric.name,
    // Dois decimais bastam (CLS é 0,0x) e deixam o corpo pequeno.
    value: Math.round(metric.value * 100) / 100,
    route: pathname.split(/[?#]/)[0].slice(0, 200) || "/",
  };
  if (metric.navigationType) report.navigationType = metric.navigationType.slice(0, 32);
  return report;
}

/** Métricas que descrevem o carregamento do DOCUMENTO (a navegação completa, não o app em uso). */
const LOAD_METRICS: ReadonlySet<VitalMetricName> = new Set(["TTFB", "FCP", "LCP"]);

/**
 * Rota a que a métrica pertence.
 *
 * TTFB, FCP e LCP medem o carregamento do documento: pertencem à página onde
 * houve o carregamento completo, que pode não ser a de agora. Entrando por
 * /login e seguindo para /admin sem recarregar, o LCP medido é o do /login, e
 * rotulá-lo com a rota atual jogaria o tempo do login na conta de /admin. INP
 * e CLS acumulam durante o uso e são fechados quando a aba esconde, então a
 * rota onde a pessoa está é a melhor atribuição que existe.
 *
 * `entryUrl` é o `name` do PerformanceNavigationTiming (URL do documento).
 */
export function routeForMetric(
  name: string,
  currentPath: string,
  entryUrl: string | null | undefined,
): string {
  if (isVitalMetric(name) && LOAD_METRICS.has(name) && entryUrl) {
    try {
      return new URL(entryUrl, "http://local.invalid").pathname || currentPath;
    } catch {
      return currentPath;
    }
  }
  return currentPath;
}

/**
 * Evita relatar duas vezes o que o navegador mediu uma só. O AppShell é
 * montado de novo ao passar entre áreas (administração -> meu clube), e o
 * useReportWebVitals não desfaz o registro anterior: sem isto, cada remontagem
 * reenviaria TTFB/FCP/LCP e dobraria INP/CLS ao esconder a aba.
 *
 * Carregamento (TTFB/FCP/LCP): uma vez por documento. INP/CLS: só se o valor
 * mudou, porque podem legitimamente subir enquanto a pessoa usa o app.
 */
export function createVitalsDeduper(): (name: VitalMetricName, value: number) => boolean {
  const sent = new Map<VitalMetricName, number>();
  return (name, value) => {
    const previous = sent.get(name);
    if (previous !== undefined && (LOAD_METRICS.has(name) || previous === value)) return false;
    sent.set(name, value);
    return true;
  };
}
