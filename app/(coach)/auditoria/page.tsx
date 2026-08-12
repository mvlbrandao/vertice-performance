import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AUDIT_AREAS, ACTION_LABEL, areaOf, describeDetails } from "@/lib/audit/describe";
import type { AuditActionType, AuditEntityType } from "@/lib/types/database";

type Search = Promise<{ area?: string }>;

const AREA_TONE: Record<string, "sky" | "amber" | "dark" | "clay" | "green"> = {
  financeiro: "amber",
  atletas: "sky",
  escalacao: "green",
  saude: "clay",
  acesso: "dark",
  desafios: "sky",
};

export default async function AuditoriaPage({ searchParams }: { searchParams: Search }) {
  const { area: areaKey } = await searchParams;
  const area = AUDIT_AREAS.find((a) => a.key === areaKey);

  const profile = await getSessionProfile();
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .eq("club_id", profile!.clubId)
    .order("performed_at", { ascending: false })
    .limit(200);
  if (area) query = query.in("entity_type", area.entities);

  const { data: logs } = await query;
  const rows = logs ?? [];

  const idsOf = (entity: AuditEntityType) =>
    rows.filter((l) => l.entity_type === entity).map((l) => l.entity_id);
  const athleteIds = [...new Set(rows.map((l) => l.athlete_id).filter(Boolean))] as string[];

  const [chargeById, expenseById, gameById, staffById, athleteById] = await Promise.all([
    mapIn<{ description: string }>(supabase, "athlete_charges", "id, description", idsOf("charge")),
    mapIn<{ description: string }>(supabase, "expenses", "id, description", idsOf("expense")),
    mapIn<{ opponent: string; scheduled_date: string }>(
      supabase,
      "games",
      "id, opponent, scheduled_date",
      idsOf("lineup"),
    ),
    mapIn<{ full_name: string }>(supabase, "profiles", "id, full_name", idsOf("access")),
    mapIn<{ full_name: string }>(supabase, "athletes", "id, full_name", athleteIds),
  ]);

  function labelFor(log: (typeof rows)[number]): string {
    const athlete = log.athlete_id ? athleteById.get(log.athlete_id)?.full_name : null;
    switch (log.entity_type) {
      case "charge": {
        const desc = chargeById.get(log.entity_id)?.description ?? "lançamento removido";
        return `${athlete ?? "Atleta"} — ${desc}`;
      }
      case "expense":
        return expenseById.get(log.entity_id)?.description ?? "despesa removida";
      case "cash_closure":
        return `Caixa do dia — ${(log.details as { closure_date?: string })?.closure_date ?? ""}`;
      case "athlete":
        return athlete ?? "atleta removido";
      case "lineup": {
        const game = gameById.get(log.entity_id);
        const match = game ? `vs. ${game.opponent} · ${game.scheduled_date}` : "jogo removido";
        return athlete ? `${athlete} — ${match}` : match;
      }
      case "injury":
        return athlete ? `Lesão de ${athlete}` : "Lesão";
      case "access": {
        // Convite guarda o id do próprio convite em entity_id, não o de um
        // profissional — ler como concessão de staff inventaria um "→".
        const details = log.details as { convite?: string; full_name?: string };
        if (details.convite) return athlete ?? details.full_name ?? "Convite";
        const person = staffById.get(log.entity_id)?.full_name;
        if (athlete) return `${person ?? "Profissional"} → ${athlete}`;
        return person ?? details.full_name ?? "Acesso";
      }
      case "challenge":
        return athlete ? `Desafio de ${athlete}` : "Desafio";
      default:
        return "—";
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[28px] m-0">Auditoria</h1>
        <div className="text-xs text-ink-faint mt-0.5">
          Quem fez o quê, e quando — no dinheiro, no cadastro, na convocação, na saúde e no acesso.
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        <FilterChip href="/auditoria" active={!area} label="Tudo" icon="📋" />
        {AUDIT_AREAS.map((a) => (
          <FilterChip
            key={a.key}
            href={`/auditoria?area=${a.key}`}
            active={area?.key === a.key}
            label={a.label}
            icon={a.icon}
          />
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="🕵️" message="Nenhum registro de auditoria nessa área ainda." />
        ) : (
          rows.map((log) => {
            const logArea = areaOf(log.entity_type as AuditEntityType);
            return (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 py-2.5 border-b border-line last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Badge tone={AREA_TONE[logArea?.key ?? ""] ?? "dark"}>
                      {logArea?.icon} {logArea?.label ?? log.entity_type}
                    </Badge>
                    <Badge tone="dark">
                      {ACTION_LABEL[log.action as AuditActionType] ?? log.action}
                    </Badge>
                  </div>
                  <b className="text-sm block">{labelFor(log)}</b>
                  <span className="text-xs text-ink-soft break-words">
                    {describeDetails(
                      log.entity_type as AuditEntityType,
                      log.action as AuditActionType,
                      log.details as Record<string, unknown>,
                    )}
                  </span>
                </div>
                <div className="sm:text-right shrink-0">
                  <span className="text-xs font-semibold block">{log.performed_by_name}</span>
                  <span className="text-[11px] text-ink-faint font-mono">
                    {new Date(log.performed_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-[12.5px] font-semibold ${
        active
          ? "bg-pitch-dark text-chalk border-pitch-dark"
          : "bg-paper text-ink-soft border-line hover:border-ink-faint"
      }`}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

/**
 * Busca os nomes de uma tabela por id e devolve pronto pra consulta. Sai
 * cedo com a lista vazia: um `in ()` sem valores é rejeitado pelo PostgREST.
 */
async function mapIn<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "athlete_charges" | "expenses" | "games" | "profiles" | "athletes",
  columns: string,
  ids: string[],
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from(table).select(columns).in("id", [...new Set(ids)]);
  const rows = (data ?? []) as unknown as ({ id: string } & T)[];
  return new Map(rows.map((r) => [r.id, r]));
}
