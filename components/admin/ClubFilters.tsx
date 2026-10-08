import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { CLUB_STATUS_LABEL, CLUB_STATUS_OPTIONS, type ClubFilters } from "@/lib/platform/clubFilters";

/**
 * Filtros da lista de clubes. É um formulário GET comum (sem JS): o estado
 * vive na URL, então o filtro sobrevive a recarregar a página e dá para
 * mandar o link filtrado.
 */
export function ClubFiltersForm({ filters }: { filters: ClubFilters }) {
  const active = filters.q !== "" || filters.status !== "todos";
  return (
    <form
      method="get"
      action="/admin/clubes"
      className="flex flex-col sm:flex-row sm:items-end gap-2.5 mb-4"
    >
      <Field label="Buscar clube" className="flex-1 min-w-0">
        <Input
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="nome ou endereço do clube"
          maxLength={80}
        />
      </Field>
      <Field label="Situação" className="sm:w-48">
        <select
          name="status"
          defaultValue={filters.status}
          className="px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
        >
          <option value="todos">Todas</option>
          {CLUB_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {CLUB_STATUS_LABEL[s]}
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
            href="/admin/clubes"
            className="text-[13px] font-semibold text-ink-soft underline px-1 py-2.5"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
