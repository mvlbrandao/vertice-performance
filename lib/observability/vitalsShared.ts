/**
 * Parte dos Web Vitals que roda TAMBÉM no navegador. Sem zod, sem Node, sem
 * nada de servidor: entra no pacote que cada pessoa baixa, então fica pequena.
 */

export const VITAL_METRICS = ["LCP", "INP", "CLS", "TTFB", "FCP"] as const;
export type VitalMetricName = (typeof VITAL_METRICS)[number];

export const VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type VitalRating = (typeof VITAL_RATINGS)[number];

export const VITALS_ENDPOINT = "/api/telemetry/vitals";

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
  rating: VitalRating;
  navigationType?: string;
  route: string;
}

/**
 * Corpo enviado ao servidor, a partir da métrica do Next (`useReportWebVitals`).
 * Devolve null para o que não nos interessa (FID, métricas internas do Next) ou
 * que veio inválido. A rota vai como o navegador a vê, SEM query string: o
 * servidor normaliza de novo, mas não há motivo para mandar token pela rede.
 */
export function buildVitalReport(
  metric: { name: string; value: number; rating?: string; navigationType?: string },
  pathname: string,
): VitalReport | null {
  if (!isVitalMetric(metric.name)) return null;
  if (!Number.isFinite(metric.value) || metric.value < 0) return null;
  const rating = (VITAL_RATINGS as readonly string[]).includes(metric.rating ?? "")
    ? (metric.rating as VitalRating)
    : null;
  if (!rating) return null;

  const report: VitalReport = {
    name: metric.name,
    // Dois decimais bastam (CLS é 0,0x) e deixam o corpo pequeno.
    value: Math.round(metric.value * 100) / 100,
    rating,
    route: pathname.split(/[?#]/)[0].slice(0, 200) || "/",
  };
  if (metric.navigationType) report.navigationType = metric.navigationType.slice(0, 32);
  return report;
}
