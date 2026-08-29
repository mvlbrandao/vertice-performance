import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ApproveEnrollmentModal } from "@/components/enrollment/ApproveEnrollmentModal";
import { RejectEnrollmentButton } from "@/components/enrollment/RejectEnrollmentButton";

export interface PendingEnrollmentRow {
  id: string;
  full_name: string;
  birth_date: string | null;
  team: string | null;
  category: string | null;
  guardian_name: string;
  guardian_phone: string | null;
  requested_at: string;
}

export function PendingEnrollments({
  requests,
  teams,
}: {
  requests: PendingEnrollmentRow[];
  teams: { name: string; categories: string[] }[];
}) {
  if (requests.length === 0) return null;

  return (
    <Card className="mb-4">
      <h3 className="mt-0 mb-3">
        📝 Matrículas pendentes <Badge tone="amber">{requests.length}</Badge>
      </h3>
      <div className="flex flex-col gap-3">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0 flex-wrap"
          >
            <div className="flex-1 min-w-[220px]">
              <b className="text-[13.5px] block">{r.full_name}</b>
              <span className="text-xs text-ink-faint block">
                Responsável: {r.guardian_name} {r.guardian_phone ? `· ${r.guardian_phone}` : ""}
              </span>
              <span className="text-xs text-ink-faint block">
                {r.birth_date ?? "Sem data de nascimento"}
                {r.team ? ` · ${r.team}` : ""}
                {r.category ? ` · ${r.category}` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 items-stretch min-w-[180px]">
              <ApproveEnrollmentModal
                requestId={r.id}
                fullName={r.full_name}
                requestedTeam={r.team}
                requestedCategory={r.category}
                teams={teams}
              />
              <RejectEnrollmentButton requestId={r.id} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
