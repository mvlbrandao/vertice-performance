/**
 * Validação do corpo de POST /api/telemetry/vitals. PURA (sem "server-only"
 * nem rede) para o teste exercitar cada recusa sem montar uma requisição.
 *
 * O endpoint recebe dado de um navegador que pode ser qualquer coisa: um
 * script, um colega curioso, um bug. Tudo é validado e a rota é normalizada
 * AQUI no servidor; o que o cliente diz sobre si mesmo não é de confiança.
 *
 * RISCO ACEITO (decisão do dono, é só telemetria): quem tem sessão pode enviar
 * valores falsos de uma rota real e, com 20 amostras ruins, deixar o semáforo
 * de desempenho em "Atenção" por uma janela. O endpoint só estreita o que é
 * barato: a nota é recalculada aqui, o valor tem teto realista, a rota precisa
 * ter o formato de uma rota do app e o envio cabe em 5 métricas. Não há como
 * provar que um valor foi mesmo medido sem gravar quem o enviou (e a
 * minimização de dados manda não gravar).
 */
import { z } from "zod";
import { normalizeRoute } from "@/lib/observability/route";
import {
  VITALS_MAX_PER_BATCH,
  VITAL_METRICS,
  ratingFor,
  type VitalMetricName,
  type VitalRating,
} from "@/lib/observability/vitalsShared";

/** Corpo máximo aceito. Cinco métricas somam ~700 bytes; 2 KB já é folga. */
export const MAX_BODY_BYTES = 2_048;

/**
 * Tetos por métrica. Servem para recusar lixo (um `value` de 1e12 estragaria
 * médias e percentis), não para julgar desempenho: acima disto o valor não é
 * uma medição de página, é bug ou ataque. 60 s já é muito além do que alguém
 * espera por um LCP (o navegador desiste antes); CLS é um somatório de
 * frações da tela e raramente passa de 1. Tempos em ms; CLS não tem unidade.
 */
const MAX_VALUE: Record<VitalMetricName, number> = {
  LCP: 60_000,
  INP: 60_000,
  TTFB: 60_000,
  FCP: 60_000,
  CLS: 10,
};

const NAV_TYPES = new Set([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);

/** Rota que não tem cara de rota do app (ou veio com lixo): cai aqui em vez de criar uma linha nova por tentativa. */
export const UNKNOWN_ROUTE = "/outras";

/**
 * Formato de rota que o app produz depois de normalizeRoute: segmentos
 * minúsculos com dígito, hífen ou sublinhado, ou ":id". Maiúscula, espaço,
 * "<", aspas e quebra de linha não existem em rota do app e nunca devem ir
 * para a tela do dono. No máximo 6 níveis.
 */
const ROUTE_SHAPE = /^\/(?:[a-z0-9_-]+|:id)(?:\/(?:[a-z0-9_-]+|:id)){0,5}$/;

/** Rota normalizada e, se não tiver o formato de uma rota do app, "/outras". */
export function vitalRoute(raw: string): string {
  const route = normalizeRoute(raw);
  return route === "/" || ROUTE_SHAPE.test(route) ? route : UNKNOWN_ROUTE;
}

const metricSchema = z
  .object({
    name: z.enum(VITAL_METRICS),
    value: z.number().min(0),
    route: z.string().min(1).max(200),
    navigationType: z.string().max(32).optional(),
  })
  .refine((v) => Number.isFinite(v.value) && v.value <= MAX_VALUE[v.name], {
    path: ["value"],
    message: "valor fora do intervalo",
  });

// As métricas são validadas uma a uma depois: uma inválida no meio não deve
// jogar fora as outras quatro que vieram certas.
const batchSchema = z.object({
  metrics: z.array(z.unknown()).min(1).max(VITALS_MAX_PER_BATCH),
});

export interface VitalRow {
  route: string;
  metric: VitalMetricName;
  value: number;
  rating: VitalRating;
  nav_type: string | null;
  device: "mobile" | "desktop";
}

/**
 * Valida o corpo e devolve as linhas para web_vitals. Vazio = nada aproveitável
 * (corpo malformado ou nenhuma métrica válida). `userAgent` só serve para
 * decidir mobile/desktop; não é gravado.
 *
 * Uma métrica por nome: um envio legítimo tem no máximo uma de cada, e deixar
 * repetir faria o corpo de 5 itens valer 5 amostras da mesma métrica.
 */
export function parseVitalsBatch(json: unknown, userAgent: string | null | undefined): VitalRow[] {
  const batch = batchSchema.safeParse(json);
  if (!batch.success) return [];

  const device = deviceFromUserAgent(userAgent);
  const seen = new Set<VitalMetricName>();
  const rows: VitalRow[] = [];

  for (const item of batch.data.metrics) {
    const parsed = metricSchema.safeParse(item);
    if (!parsed.success) continue;
    const { name, value, route, navigationType } = parsed.data;
    if (seen.has(name)) continue;
    seen.add(name);

    rows.push({
      route: vitalRoute(route),
      metric: name,
      value,
      // Recalculada: a nota que o navegador diz ter tirado não entra.
      rating: ratingFor(name, value),
      nav_type: navigationType && NAV_TYPES.has(navigationType) ? navigationType : null,
      device,
    });
  }
  return rows;
}

/**
 * mobile ou desktop a partir do user-agent. Tablet conta como mobile (toque,
 * rede móvel, tela pequena para o que o app desenha). Ausente = desktop: é o
 * lado "otimista" e o mais raro de errar para quem usa o app.
 */
export function deviceFromUserAgent(userAgent: string | null | undefined): "mobile" | "desktop" {
  if (!userAgent) return "desktop";
  return /Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle|Opera Mini|IEMobile/i.test(userAgent)
    ? "mobile"
    : "desktop";
}
