import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyNote } from "@/components/admin/health/EmptyNote";
import { formatCount, formatVital } from "@/lib/platform/healthFormat";
import {
  VITAL_DESCRIPTIONS,
  VITAL_ORDER,
  VITAL_THRESHOLDS,
  type VitalCell,
  type VitalRouteView,
  type VitalTone,
} from "@/lib/platform/healthRules";
import type { WebVitalMetric } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";
import { LEVEL_STYLE, TONE_LABEL, TONE_LEVEL } from "@/components/admin/health/levels";

/** Valor colorido pelo próprio nível, com o nível por extenso para leitor de tela. */
function Percentile({ label, metric, value, tone, strong }: { label: string; metric: WebVitalMetric; value: number; tone: VitalTone; strong?: boolean }) {
  const style = LEVEL_STYLE[TONE_LEVEL[tone]];
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className={cn("tabular-nums", style.text, strong ? "text-[15px] font-bold" : "text-xs font-semibold")}>
        <span aria-hidden="true" className="mr-1 text-[10px]">
          {style.symbol}
        </span>
        {formatVital(metric, value)}
        <span className="sr-only"> ({TONE_LABEL[tone]})</span>
      </span>
    </div>
  );
}

function MetricCell({ metric, cell }: { metric: WebVitalMetric; cell: VitalCell | undefined }) {
  if (!cell) {
    return (
      <div className="rounded-sm border border-line px-3 py-2 min-w-0">
        <b className="text-xs">{metric}</b>
        <div className="text-xs text-ink-faint mt-1">sem medidas</div>
      </div>
    );
  }
  const style = LEVEL_STYLE[TONE_LEVEL[cell.tone]];
  return (
    <div className={cn("rounded-sm border border-line border-l-4 px-3 py-2 min-w-0", style.border)}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <b className="text-xs">{metric}</b>
        <span className={cn("text-[10px] font-bold uppercase tracking-wide", style.text)}>{TONE_LABEL[cell.tone]}</span>
      </div>
      <Percentile label="p75" metric={metric} value={cell.p75} tone={cell.tone} strong />
      <Percentile label="p50" metric={metric} value={cell.p50} tone={cell.p50Tone} />
      <Percentile label="p95" metric={metric} value={cell.p95} tone={cell.p95Tone} />
      <div className="text-[11px] text-ink-faint mt-1">
        {formatCount(cell.samples)} {cell.samples === 1 ? "medida" : "medidas"} · {cell.poorPct.toLocaleString("pt-BR")}% ruins
      </div>
    </div>
  );
}

/** Régua oficial de cada métrica, para o dono saber o que "bom" quer dizer. */
function Legend() {
  return (
    <details className="mb-3">
      <summary className="cursor-pointer py-1.5 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center text-[13px] font-semibold text-ink-soft">
        Como ler as cores
      </summary>
      <div className="rounded-md border border-line bg-paper p-3 text-xs text-ink-soft">
        <p className="m-0 mb-2">
          A avaliação oficial usa o <b>p75</b>: três em cada quatro visitas foram melhores que esse valor. O p50 é a
          visita típica e o p95 mostra o pior caso comum. Bom ≤ limite verde; ruim acima do vermelho; entre os dois,
          atenção.
        </p>
        <ul className="m-0 p-0 list-none grid gap-1 sm:grid-cols-2">
          {VITAL_ORDER.map((metric) => (
            <li key={metric}>
              <b>{metric}</b> ({VITAL_DESCRIPTIONS[metric]}): bom ≤ {formatVital(metric, VITAL_THRESHOLDS[metric].good)}, ruim &gt;{" "}
              {formatVital(metric, VITAL_THRESHOLDS[metric].poor)}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function VitalsRoutes({ routes, totalRoutes }: { routes: VitalRouteView[]; totalRoutes: number }) {
  if (routes.length === 0) {
    return (
      <EmptyNote
        icon="📈"
        title="Nenhuma medida de desempenho nesta janela."
        hint="A coleta começa após o deploy desta versão: cada pessoa logada que abre uma tela envia as medidas do próprio navegador. Se há um filtro de dispositivo ativo, tente “Todos”."
      />
    );
  }

  return (
    <>
      <Legend />
      <div className="flex flex-col gap-3">
        {routes.map((view) => (
          <Card key={`${view.route}|${view.device}`} className="!p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
              <code className="font-mono text-[13px] font-semibold break-all min-w-0">{view.route}</code>
              <Badge tone="dark">{view.device === "mobile" ? "Celular" : "Computador"}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {VITAL_ORDER.map((metric) => (
                <MetricCell key={metric} metric={metric} cell={view.metrics[metric]} />
              ))}
            </div>
          </Card>
        ))}
      </div>
      {totalRoutes > routes.length && (
        <p className="text-[11px] text-ink-faint mt-2 mb-0">
          Mostrando as {routes.length} telas mais usadas de {totalRoutes}.
        </p>
      )}
    </>
  );
}
