/**
 * Validação do corpo de POST /api/telemetry/vitals. PURA (sem "server-only"
 * nem rede) para o teste exercitar cada recusa sem montar uma requisição.
 *
 * O endpoint recebe dado de um navegador que pode ser qualquer coisa: um
 * script, um colega curioso, um bug. Tudo é validado e a rota é normalizada
 * AQUI no servidor; o que o cliente diz sobre si mesmo não é de confiança.
 */
import { z } from "zod";
import { normalizeRoute } from "@/lib/observability/route";
import {
  VITAL_METRICS,
  VITAL_RATINGS,
  type VitalMetricName,
  type VitalRating,
} from "@/lib/observability/vitalsShared";

/** Corpo máximo aceito. Um relatório legítimo tem ~150 bytes; 2 KB já é folga. */
export const MAX_BODY_BYTES = 2_048;

/**
 * Tetos por métrica. Servem para recusar lixo (um `value` de 1e12 estragaria
 * médias e percentis), não para julgar desempenho: valores acima disso nunca
 * são medições, são bug ou ataque. Tempos em ms; CLS não tem unidade.
 */
const MAX_VALUE: Record<VitalMetricName, number> = {
  LCP: 120_000,
  INP: 120_000,
  TTFB: 120_000,
  FCP: 120_000,
  CLS: 50,
};

const NAV_TYPES = new Set([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);

const schema = z
  .object({
    name: z.enum(VITAL_METRICS),
    value: z.number().min(0),
    rating: z.enum(VITAL_RATINGS),
    route: z.string().min(1).max(200),
    navigationType: z.string().max(32).optional(),
  })
  .refine((v) => Number.isFinite(v.value) && v.value <= MAX_VALUE[v.name], {
    path: ["value"],
    message: "valor fora do intervalo",
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
 * Valida o corpo e devolve a linha para web_vitals, ou null se for inválido.
 * `userAgent` só serve para decidir mobile/desktop; não é gravado.
 */
export function parseVitalPayload(json: unknown, userAgent: string | null | undefined): VitalRow | null {
  const parsed = schema.safeParse(json);
  if (!parsed.success) return null;
  const { name, value, rating, route, navigationType } = parsed.data;

  return {
    route: normalizeRoute(route),
    metric: name,
    value,
    rating,
    nav_type: navigationType && NAV_TYPES.has(navigationType) ? navigationType : null,
    device: deviceFromUserAgent(userAgent),
  };
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
