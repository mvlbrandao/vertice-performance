/**
 * Formatação de números e tempos da tela /admin/saude. PURO: o instante "agora"
 * entra por parâmetro, para o teste não depender do relógio.
 */
import type { WebVitalMetric } from "@/lib/types/database";

const INTEGER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO_DECIMALS = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCount(value: number): string {
  return INTEGER.format(Number.isFinite(value) ? value : 0);
}

/** 240 -> "240 ms"; 2431 -> "2,4 s". */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  // Arredonda ANTES de comparar: 999,6 ms viraria "1.000 ms" em vez de "1,0 s".
  const rounded = Math.round(ms);
  if (rounded < 1_000) return `${INTEGER.format(rounded)} ms`;
  return `${ONE_DECIMAL.format(ms / 1_000)} s`;
}

/** CLS não tem unidade ("0,12"); as demais métricas são tempos. */
export function formatVital(metric: WebVitalMetric, value: number): string {
  if (!Number.isFinite(value)) return "—";
  return metric === "CLS" ? TWO_DECIMALS.format(value) : formatMs(value);
}

/** "há 5 min", "há 3 h", "há 2 dias". Instante no futuro ou ilegível não inventa nada. */
export function formatAgo(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.round((nowMs - then) / 1_000));
  if (seconds < 60) return "agora há pouco";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

/** Duração de uma execução: 850 -> "850 ms", 75_000 -> "1 min 15 s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1_000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

/** "08/10" a partir de "2026-10-08" (rótulo curto do gráfico). */
export function formatDayShort(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}/${month}` : day;
}
