import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AUDIT_ENTITY_LABELS,
  auditActionLabel,
  auditEntityOf,
  describeAuditDetails,
  formatAuditTime,
} from "@/lib/platform/auditLabels";
import { auditHref } from "@/lib/platform/auditQuery";

export interface AuditRowView {
  id: string;
  occurred_at: string;
  actor_email: string;
  action: string;
  target_club_id: string | null;
  target_club_name: string | null;
  details: unknown;
  ip: string | null;
}

const ENTITY_TONE: Record<string, "amber" | "sky" | "dark"> = {
  settings: "amber",
  club: "sky",
};

export function AuditTable({ rows }: { rows: AuditRowView[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="🕵️" message="Nenhum registro com esses filtros." />
      </Card>
    );
  }

  return (
    <Card className="!p-0 sm:!px-5 sm:!py-2">
      {rows.map((row) => {
        const entity = auditEntityOf(row.action);
        const lines = describeAuditDetails(row.details);
        return (
          <article
            key={row.id}
            className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 px-4 sm:px-0 py-3 border-b border-line last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <Badge tone={ENTITY_TONE[entity] ?? "dark"}>
                  {AUDIT_ENTITY_LABELS[entity] ?? entity}
                </Badge>
                <b className="text-sm">{auditActionLabel(row.action)}</b>
              </div>

              {row.target_club_name && (
                <div className="text-[13px] mb-1">
                  {row.target_club_id ? (
                    <Link
                      href={auditHref({ clubId: row.target_club_id })}
                      className="font-semibold underline decoration-line underline-offset-2"
                      title="Ver só a trilha deste clube"
                    >
                      {row.target_club_name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{row.target_club_name}</span>
                  )}
                </div>
              )}

              {lines.length > 0 && (
                <dl className="m-0 flex flex-col gap-0.5">
                  {lines.map((line, i) => (
                    <div key={i} className="text-xs text-ink-soft break-words">
                      <dt className="inline font-semibold">{line.label}: </dt>
                      <dd className="inline m-0">
                        {line.value !== undefined ? (
                          line.value
                        ) : (
                          <>
                            <span className="text-ink-faint">{line.from}</span>
                            <span aria-label="para" className="mx-1">
                              →
                            </span>
                            <b className="text-ink">{line.to}</b>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="sm:text-right shrink-0 min-w-0">
              <span className="text-xs font-semibold block break-all">{row.actor_email}</span>
              <time
                dateTime={row.occurred_at}
                className="text-[11px] text-ink-faint font-mono block"
              >
                {formatAuditTime(row.occurred_at)}
              </time>
              {row.ip && <span className="text-[11px] text-ink-faint font-mono block">{row.ip}</span>}
            </div>
          </article>
        );
      })}
    </Card>
  );
}
