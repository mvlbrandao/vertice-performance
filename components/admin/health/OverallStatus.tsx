import { Card } from "@/components/ui/Card";
import type { HealthIssue, HealthLevel } from "@/lib/platform/healthRules";
import { LEVEL_STYLE } from "@/components/admin/health/levels";
import { StatusBadge } from "@/components/admin/health/StatusBadge";
import { cn } from "@/lib/utils/cn";

const HEADLINE: Record<HealthLevel, string> = {
  ok: "Tudo certo",
  atencao: "Atenção",
  critico: "Há problemas",
  neutro: "Sem dados",
};

/** Semáforo geral para o cabeçalho da página (vai no slot `actions` do AdminPageHeader). */
export function OverallBadge({ level }: { level: HealthLevel }) {
  return <StatusBadge level={level} label={HEADLINE[level]} className="text-xs px-3.5 py-1.5" />;
}

/** O que está fora do verde, em frases. Vazio = uma linha de confirmação. */
export function IssueList({ issues, level, updatedAt }: { issues: HealthIssue[]; level: HealthLevel; updatedAt: string }) {
  return (
    <Card className={cn("mb-5 border-l-4", LEVEL_STYLE[level].border)}>
      {issues.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-soft">
          Nenhum problema nas verificações disponíveis agora. Atualizado em {updatedAt} (horário de Brasília).
        </p>
      ) : (
        <>
          <b className="block text-sm mb-1.5">O que precisa de atenção</b>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] min-w-0">
                <span className={cn("font-bold w-4 text-center shrink-0", LEVEL_STYLE[issue.level].text)} aria-hidden="true">
                  {LEVEL_STYLE[issue.level].symbol}
                </span>
                <span className="min-w-0 break-words">
                  <span className="sr-only">{LEVEL_STYLE[issue.level].label}: </span>
                  {issue.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[11px] text-ink-faint">Atualizado em {updatedAt} (horário de Brasília).</p>
        </>
      )}
    </Card>
  );
}
