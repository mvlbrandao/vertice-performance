"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChargeRow } from "@/components/billing/ChargeRow";
import type { ChargeStatus } from "@/lib/types/database";

export interface ChargeListItem {
  id: string;
  athlete_id: string;
  description: string;
  amount_cents: number;
  discount_cents: number;
  competence_month: number;
  competence_year: number;
  due_date: string;
  status: ChargeStatus;
}

const INSTALLMENT_PATTERN = /^(.*) \((\d+)\/(\d+)\)$/;

function parseInstallment(description: string) {
  const match = description.match(INSTALLMENT_PATTERN);
  if (!match) return { base: description, index: 1, total: 1 };
  return { base: match[1], index: Number(match[2]), total: Number(match[3]) };
}

const SORT_OPTIONS = [
  { value: "due_desc", label: "Vencimento (mais distante primeiro)" },
  { value: "due_asc", label: "Vencimento (mais próximo primeiro)" },
  { value: "installment", label: "Parcela (por lançamento)" },
];

export function ChargesList({ charges }: { charges: ChargeListItem[] }) {
  const [sort, setSort] = useState("due_desc");

  const sorted = useMemo(() => {
    const list = [...charges];
    if (sort === "due_asc") {
      return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
    }
    if (sort === "installment") {
      const parsed = list.map((c) => ({ charge: c, ...parseInstallment(c.description) }));
      const earliestByBase = new Map<string, string>();
      for (const p of parsed) {
        const current = earliestByBase.get(p.base);
        if (!current || p.charge.due_date < current) earliestByBase.set(p.base, p.charge.due_date);
      }
      return parsed
        .sort((a, b) => {
          const baseCompare = (earliestByBase.get(a.base) ?? "").localeCompare(
            earliestByBase.get(b.base) ?? "",
          );
          if (baseCompare !== 0) return baseCompare;
          return a.index - b.index;
        })
        .map((p) => p.charge);
    }
    return list.sort((a, b) => b.due_date.localeCompare(a.due_date));
  }, [charges, sort]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-xs font-semibold text-ink-soft">Lançamentos</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-2.5 py-1.5 border border-line rounded-sm bg-white text-[12px] font-semibold text-ink-soft"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon="💳" message="Nenhum lançamento registrado ainda." />
      ) : (
        sorted.map((c) => (
          <ChargeRow
            key={c.id}
            id={c.id}
            athleteId={c.athlete_id}
            description={c.description}
            amountCents={c.amount_cents}
            discountCents={c.discount_cents}
            competenceMonth={c.competence_month}
            competenceYear={c.competence_year}
            dueDate={c.due_date}
            status={c.status}
            canManage
          />
        ))
      )}
    </Card>
  );
}
