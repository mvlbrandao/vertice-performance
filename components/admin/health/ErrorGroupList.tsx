import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyNote } from "@/components/admin/health/EmptyNote";
import { formatCount } from "@/lib/platform/healthFormat";
import { formatAuditTime } from "@/lib/platform/auditLabels";
import type { ErrorGroupView } from "@/lib/platform/healthRules";
import { StatusBadge } from "@/components/admin/health/StatusBadge";

/** Quantos grupos a página desenha. O resto existe no banco, mas 200 cartões não ajudam a achar nada. */
export const MAX_GROUPS_SHOWN = 50;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-faint uppercase tracking-wide">{label}</dt>
      <dd className="m-0 text-xs break-words">{children}</dd>
    </div>
  );
}

/**
 * Falhas agrupadas pela impressão digital (origem + rota + mensagem
 * normalizada). A mensagem entra como TEXTO do React, que escapa tudo: nada
 * que venha do banco pode virar HTML ou script na tela do dono.
 */
export function ErrorGroupList({ groups, truncated }: { groups: ErrorGroupView[]; truncated: boolean }) {
  if (groups.length === 0) {
    return <EmptyNote icon="✅" title="Nenhum grupo de erro nesta janela." />;
  }

  const shown = groups.slice(0, MAX_GROUPS_SHOWN);

  return (
    <Card className="!p-0 sm:!px-5 sm:!py-2">
      {shown.map((group, index) => (
        <article key={`${group.id}-${index}`} className="px-4 sm:px-0 py-3 border-b border-line last:border-b-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <StatusBadge
              level={group.severity === "error" ? "critico" : "atencao"}
              label={group.severity === "error" ? "Erro" : "Aviso"}
            />
            <Badge tone="dark">{group.sourceLabel}</Badge>
            <code className="font-mono text-xs break-all min-w-0">{group.route}</code>
          </div>

          <p className="m-0 mb-2.5 rounded-sm bg-chalk px-2.5 py-2 font-mono text-xs break-words whitespace-pre-wrap">
            {group.message}
          </p>

          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Fact label="Ocorrências">{formatCount(group.occurrences)}</Fact>
            <Fact label="Clubes afetados">
              {group.clubsAffected > 0 ? formatCount(group.clubsAffected) : <span title="Clube não identificado">—</span>}
            </Fact>
            <Fact label="Primeira vez">{formatAuditTime(group.firstSeen)}</Fact>
            <Fact label="Última vez">{formatAuditTime(group.lastSeen)}</Fact>
            {group.digest && (
              <Fact label="Digest">
                <code className="font-mono">{group.digest}</code>
              </Fact>
            )}
            <Fact label="Grupo">
              <code className="font-mono">{group.id}</code>
            </Fact>
          </dl>
        </article>
      ))}

      <div className="px-4 sm:px-0 py-3 text-[11px] text-ink-faint border-t border-line">
        {groups.length > MAX_GROUPS_SHOWN || truncated
          ? `Mostrando ${shown.length} de ${groups.length}${truncated ? " ou mais" : ""} grupos: erros primeiro, do mais recente ao mais antigo. `
          : ""}
        “Clubes afetados” conta só ocorrências em que o clube era conhecido (rotinas agendadas); nas demais aparece “—”.
        Em “Digest”, o código que o Next mostra ao usuário e que casa com o log do servidor.
      </div>
    </Card>
  );
}
