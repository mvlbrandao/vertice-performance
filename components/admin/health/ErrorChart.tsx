import { Card } from "@/components/ui/Card";
import { EmptyNote } from "@/components/admin/health/EmptyNote";
import { formatCount, formatDayShort } from "@/lib/platform/healthFormat";
import type { DailyPoint } from "@/lib/platform/healthRules";
import { cn } from "@/lib/utils/cn";

/**
 * Barras diárias de erros e avisos, em HTML/CSS puro (sem biblioteca e sem
 * JavaScript no navegador). Segue as regras do projeto de gráficos: barra de
 * no máximo 24 px, canto superior arredondado e base reta, 2 px de respiro
 * entre os segmentos, grade fina, legenda sempre presente com duas séries e
 * uma tabela como visão alternativa.
 *
 * Erros e avisos não dependem só da cor: o aviso leva listras diagonais, e a
 * ordem da pilha é fixa (erros na base).
 */

const ERROR_FILL = "bg-[#D72B2B]";
const WARN_FILL = "bg-[image:repeating-linear-gradient(45deg,#C99A00_0_3px,#F6DE7A_3px_6px)]";
const CHART_HEIGHT = "h-[132px]";

function plural(n: number, one: string, many: string) {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function describePoint(point: DailyPoint) {
  const where = point.isToday ? `${formatDayShort(point.day)} (hoje, até agora)` : formatDayShort(point.day);
  return `${where}: ${plural(point.errors, "erro", "erros")}, ${plural(point.warnings, "aviso", "avisos")}`;
}

export function ErrorChart({
  points,
  totals,
}: {
  points: DailyPoint[];
  totals: { errors: number; warnings: number };
}) {
  if (totals.errors + totals.warnings === 0) {
    return (
      <EmptyNote
        icon="✅"
        title="Nenhum erro nem aviso registrado nesta janela."
        hint="A coleta começa após o deploy desta versão; até o primeiro registro, estar vazio é o esperado."
      />
    );
  }

  const max = Math.max(1, ...points.map((p) => p.errors + p.warnings));
  const labelStep = points.length <= 8 ? 1 : 5;
  const last = points.length - 1;

  return (
    <Card>
      <ul className="m-0 mb-3 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block size-3 rounded-[3px]", ERROR_FILL)} />
          Erros ({formatCount(totals.errors)})
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block size-3 rounded-[3px]", WARN_FILL)} />
          Avisos ({formatCount(totals.warnings)})
        </li>
      </ul>

      <div
        role="img"
        aria-label={`Erros e avisos por dia. ${plural(totals.errors, "erro", "erros")} e ${plural(totals.warnings, "aviso", "avisos")} no período. Os valores de cada dia estão na tabela abaixo.`}
        className="px-3"
      >
        <div className={cn("relative border-b border-line", CHART_HEIGHT)}>
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line" />
          <span aria-hidden="true" className="absolute -top-2 -left-3 bg-paper px-0.5 text-[10px] text-ink-faint leading-none">
            {formatCount(max)}
          </span>

          <div className="relative flex h-full items-end gap-[3px]">
            {points.map((point, index) => {
              const total = point.errors + point.warnings;
              const segments = [
                { key: "e", value: point.errors, fill: ERROR_FILL },
                { key: "w", value: point.warnings, fill: WARN_FILL },
              ].filter((s) => s.value > 0);
              const align =
                index <= last * 0.25 ? "left-0" : index >= last * 0.75 ? "right-0" : "left-1/2 -translate-x-1/2";

              return (
                <div key={point.day} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  {total > 0 && (
                    // Altura proporcional ao total; os segmentos dividem essa altura
                    // pelo valor, com 2 px de superfície entre eles.
                    <div
                      className="flex w-full max-w-6 flex-col-reverse gap-0.5"
                      style={{ height: `${(total / max) * 100}%`, minHeight: 3 }}
                    >
                      {segments.map((segment, i) => (
                        <div
                          key={segment.key}
                          className={cn(segment.fill, i === segments.length - 1 && "rounded-t-[4px]")}
                          style={{ flexGrow: segment.value, flexBasis: 0, minHeight: 3 }}
                        />
                      ))}
                    </div>
                  )}
                  {/* Dica ao passar o mouse (ou tocar). Quem usa teclado ou leitor de tela lê a tabela abaixo. */}
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[220px] rounded-sm bg-pitch-dark px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-card group-hover:block",
                      align,
                    )}
                  >
                    {describePoint(point)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div aria-hidden="true" className="flex gap-[3px] pt-1">
          {points.map((point, index) => (
            <div key={point.day} className="relative h-4 min-w-0 flex-1">
              {(index % labelStep === 0 || index === last) && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-ink-faint">
                  {formatDayShort(point.day)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer py-1.5 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center text-[13px] font-semibold text-ink-soft">
          Ver como tabela
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">Erros e avisos por dia</caption>
            <thead>
              <tr className="text-left text-ink-faint">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Dia</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Erros</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Avisos</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.day} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {formatDayShort(point.day)}
                    {point.isToday && <span className="text-ink-faint"> (hoje, até agora)</span>}
                  </th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCount(point.errors)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCount(point.warnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
