import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/platform/auditLabels";
import type { AuditFilters } from "@/lib/platform/auditQuery";

const SELECT_CLASS = "px-3 py-2.5 border border-line rounded-sm bg-white text-sm min-w-0";

/**
 * Filtros da trilha: por área/ação e por clube. Formulário GET comum; trocar
 * o filtro volta à primeira página (o cursor `antes` não é reenviado).
 */
export function AuditFiltersForm({
  filters,
  clubs,
}: {
  filters: AuditFilters;
  clubs: { id: string; name: string }[];
}) {
  // Clube já removido (expurgo) não está na lista, mas a URL pode apontar para
  // ele; sem esta opção o filtro ativo ficaria invisível.
  const clubKnown = !filters.clubId || clubs.some((c) => c.id === filters.clubId);
  const active = filters.action !== null || filters.clubId !== null;

  return (
    <form
      method="get"
      action="/admin/auditoria"
      className="flex flex-col sm:flex-row sm:items-end gap-2.5 mb-4"
    >
      <Field label="Ação" className="sm:w-64 min-w-0">
        <select name="acao" defaultValue={filters.action ?? ""} className={SELECT_CLASS}>
          <option value="">Todas</option>
          <optgroup label="Por área">
            {Object.entries(AUDIT_ENTITY_LABELS).map(([entity, label]) => (
              <option key={entity} value={entity}>
                {label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ação específica">
            {Object.entries(AUDIT_ACTION_LABELS).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <Field label="Clube" className="sm:w-64 min-w-0">
        <select name="clube" defaultValue={filters.clubId ?? ""} className={SELECT_CLASS}>
          <option value="">Todos</option>
          {!clubKnown && filters.clubId && (
            <option value={filters.clubId}>Clube removido ({filters.clubId.slice(0, 8)})</option>
          )}
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-center gap-2">
        <Button variant="solid" size="md" type="submit">
          Filtrar
        </Button>
        {active && (
          <Link
            href="/admin/auditoria"
            className="text-[13px] font-semibold text-ink-soft underline px-1 py-2.5"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
