import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  CONTRACT_STATUS_OPTIONS,
  CYCLE_OPTIONS,
  EXPIRY_FILTER_LABEL,
  EXPIRY_OPTIONS,
  hasActiveContractFilters,
  type ContractFilters,
} from "@/lib/platform/contractFilters";
import { CYCLE_LABEL, STATUS_LABEL } from "@/lib/platform/contractRules";

const SELECT_CLASS = "px-3 py-2.5 border border-line rounded-sm bg-white text-sm min-w-0";

/**
 * Filtros da lista de contratos. Formulário GET comum (sem JS): o estado vive
 * na URL, então sobrevive a recarregar a página e dá para mandar o link
 * filtrado.
 */
export function ContractFiltersForm({ filters }: { filters: ContractFilters }) {
  return (
    <form
      method="get"
      action="/admin/contratos"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] gap-2.5 lg:items-end mb-4"
    >
      <label className="flex flex-col gap-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Buscar</span>
        <Input
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="clube ou CT-número"
          maxLength={80}
        />
      </label>

      <Field label="Situação" className="min-w-0">
        <select name="status" defaultValue={filters.status} className={SELECT_CLASS} aria-label="Situação">
          <option value="todos">Todas</option>
          {CONTRACT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Vencimento" className="min-w-0">
        <select name="vencimento" defaultValue={filters.vencimento} className={SELECT_CLASS} aria-label="Vencimento">
          <option value="todos">Qualquer</option>
          {EXPIRY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {EXPIRY_FILTER_LABEL[option]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ciclo" className="min-w-0">
        <select name="ciclo" defaultValue={filters.ciclo} className={SELECT_CLASS} aria-label="Ciclo">
          <option value="todos">Todos</option>
          {CYCLE_OPTIONS.map((cycle) => (
            <option key={cycle} value={cycle}>
              {CYCLE_LABEL[cycle]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Documento" className="min-w-0">
        <select name="documento" defaultValue={filters.documento} className={SELECT_CLASS} aria-label="Documento">
          <option value="todos">Todos</option>
          <option value="sem">Sem PDF anexado</option>
        </select>
      </Field>

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
        <Button variant="solid" size="md" type="submit">
          Filtrar
        </Button>
        {hasActiveContractFilters(filters) && (
          <Link
            href="/admin/contratos"
            className="text-[13px] font-semibold text-ink-soft underline px-1 py-2.5 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
