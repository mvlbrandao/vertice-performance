import { Card } from "@/components/ui/Card";
import { formatAgo, formatDuration } from "@/lib/platform/healthFormat";
import { formatAuditTime } from "@/lib/platform/auditLabels";
import { CRON_STATE_LABELS, cronLevel, cronState, type CronRunRow } from "@/lib/platform/healthRules";
import type { CronView } from "@/lib/platform/health";
import { cn } from "@/lib/utils/cn";
import { LEVEL_STYLE } from "@/components/admin/health/levels";
import { StatusBadge } from "@/components/admin/health/StatusBadge";

/** Uma bolinha por execução recente (a mais nova primeiro): dá para ver "falhou três dias seguidos" de relance. */
function History({ runs, nowMs }: { runs: CronRunRow[]; nowMs: number }) {
  if (runs.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-3">
      <span className="text-[11px] text-ink-faint">Últimas {runs.length}:</span>
      <ul className="m-0 p-0 list-none flex gap-1">
        {runs.map((run) => {
          const state = cronState(run, nowMs);
          // O atraso só vale para a última execução; no histórico conta como ok.
          const level = cronLevel(state === "atrasado" ? "ok" : state);
          const style = LEVEL_STYLE[level];
          return (
            <li
              key={run.id}
              title={`${formatAuditTime(run.started_at)}: ${state === "atrasado" ? "ok" : CRON_STATE_LABELS[state].toLowerCase()}`}
              className={cn("flex size-5 items-center justify-center rounded-[4px] text-[11px] font-bold", style.badge)}
            >
              <span aria-hidden="true">{style.symbol}</span>
              <span className="sr-only">
                {formatAuditTime(run.started_at)}: {state === "atrasado" ? "ok" : CRON_STATE_LABELS[state]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CronList({ crons, nowMs }: { crons: CronView[]; nowMs: number }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {crons.map((cron) => (
        <Card key={cron.job} className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <b className="block text-sm">{cron.label}</b>
              <span className="text-[11px] text-ink-faint">
                <code className="font-mono">{cron.job}</code> · {cron.schedule}
              </span>
            </div>
            <StatusBadge level={cron.level} label={CRON_STATE_LABELS[cron.state]} />
          </div>

          {cron.lastRun ? (
            <>
              <p className="m-0 mt-3 text-[13px]">
                Última execução em {formatAuditTime(cron.lastRun.started_at)}{" "}
                <span className="text-ink-faint">({formatAgo(cron.lastRun.started_at, nowMs)})</span>
                {cron.lastRun.finished_at && (
                  <span className="text-ink-faint"> · duração {formatDuration(cron.lastRun.duration_ms)}</span>
                )}
              </p>

              {cron.state === "interrompida" && (
                <p className="m-0 mt-2 text-xs text-ink-soft">
                  A execução começou e não terminou: a função foi encerrada no meio (tempo esgotado) ou caiu.
                </p>
              )}

              {cron.lastRun.error && (
                <p className="m-0 mt-2 rounded-sm bg-[#FDE8E8] px-2.5 py-2 font-mono text-xs break-words text-[#7A1515]">
                  {cron.lastRun.error}
                </p>
              )}

              {cron.summary.length > 0 && (
                <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {cron.summary.map((line) => (
                    <div key={line.label} className="min-w-0">
                      <dt className="text-[11px] text-ink-faint">{line.label}</dt>
                      <dd className="m-0 text-xs break-words">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          ) : (
            <p className="m-0 mt-3 text-[13px] text-ink-soft">
              Nenhuma execução registrada ainda. A coleta começa após o deploy desta versão; a primeira aparece no
              próximo horário agendado ({cron.schedule}).
            </p>
          )}

          <History runs={cron.recent} nowMs={nowMs} />
        </Card>
      ))}
    </div>
  );
}
