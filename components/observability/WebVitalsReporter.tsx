"use client";

import { useReportWebVitals } from "next/web-vitals";
import {
  buildVitalReport,
  createVitalsDeduper,
  parseSampleRate,
  routeForMetric,
  shouldSample,
} from "@/lib/observability/vitalsShared";
import { sendVitalReport } from "@/lib/observability/vitalsSend";

type Reporter = Parameters<typeof useReportWebVitals>[0];

// A variável precisa ser lida assim, literal: o Next só troca
// `process.env.NEXT_PUBLIC_*` por valor no pacote do navegador quando o nome
// aparece escrito por inteiro.
const SAMPLE_RATE = parseSampleRate(process.env.NEXT_PUBLIC_VITALS_SAMPLE_RATE);

// Sorteio UMA vez por carregamento de página (não por métrica): quem entra na
// amostra manda as cinco métricas, e as percentis por rota comparam gente com
// o mesmo conjunto de dados. Preguiçoso para não sortear no servidor.
let sampled: boolean | null = null;
const notYetSent = createVitalsDeduper();

function navigationEntryUrl(): string | null {
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry?.name ?? null;
  } catch {
    return null;
  }
}

// Função de módulo, não declarada dentro do componente: o useReportWebVitals
// reassina os observadores a cada nova referência do callback, e o Next avisa
// que isso reporta o mesmo dado de novo.
const report: Reporter = (metric) => {
  try {
    sampled ??= shouldSample(SAMPLE_RATE);
    if (!sampled) return;

    const route = routeForMetric(metric.name, window.location.pathname, navigationEntryUrl());
    const payload = buildVitalReport(metric, route);
    if (!payload || !notYetSent(payload.name, payload.value)) return;

    sendVitalReport(payload);
  } catch {
    // Medir desempenho não pode quebrar a tela.
  }
};

/**
 * Mede LCP, INP, CLS, TTFB e FCP de quem usa o sistema (RUM) e envia para
 * /api/telemetry/vitals. Não renderiza nada. Montado uma vez no AppShell, que
 * só existe para quem está logado (o endpoint exige sessão).
 */
export function WebVitalsReporter() {
  useReportWebVitals(report);
  return null;
}
