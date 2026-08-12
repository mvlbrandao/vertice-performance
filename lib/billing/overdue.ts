import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Faixas de atraso — a régua clássica de cobrança de escolinha. */
export const AGING_BUCKETS = [
  { key: "1-7", label: "1 a 7 dias", min: 1, max: 7, tone: "amber" as const },
  { key: "8-15", label: "8 a 15 dias", min: 8, max: 15, tone: "amber" as const },
  { key: "16-30", label: "16 a 30 dias", min: 16, max: 30, tone: "clay" as const },
  { key: "30+", label: "Mais de 30 dias", min: 31, max: Infinity, tone: "dark" as const },
];

export interface OverdueCharge {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  daysLate: number;
}

export interface OverdueAthlete {
  athleteId: string;
  fullName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  charges: OverdueCharge[];
  totalCents: number;
  maxDaysLate: number;
  bucket: string;
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = Date.UTC(...(fromISO.split("-").map(Number) as [number, number, number]));
  const b = Date.UTC(...(toISO.split("-").map(Number) as [number, number, number]));
  return Math.round((b - a) / 86400000);
}

export function bucketFor(daysLate: number) {
  return AGING_BUCKETS.find((b) => daysLate >= b.min && daysLate <= b.max)?.key ?? "1-7";
}

/**
 * Agrupa por atleta tudo que está vencido e não pago. Uma cobrança conta como
 * atrasada tanto pelo status explícito quanto por estar "Pendente" com
 * vencimento no passado — mesma regra já usada nos KPIs do financeiro, pra
 * não haver divergência entre as telas.
 */
export async function getOverdueByAthlete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  todayISO: string,
): Promise<OverdueAthlete[]> {
  const { data: charges } = await supabase
    .from("athlete_charges")
    .select(
      "id, athlete_id, description, amount_cents, discount_cents, due_date, status, athletes(full_name, guardian_name, guardian_phone, guardian_email, is_active)",
    )
    .eq("club_id", clubId)
    .in("status", ["Pendente", "Atrasado"])
    .lt("due_date", todayISO)
    .order("due_date", { ascending: true });

  const byAthlete = new Map<string, OverdueAthlete>();

  for (const c of charges ?? []) {
    const a = c.athletes as unknown as {
      full_name: string;
      guardian_name: string | null;
      guardian_phone: string | null;
      guardian_email: string | null;
      is_active: boolean;
    } | null;
    // Atleta desativado não entra na régua: cobrar quem já saiu gera atrito
    // com o responsável e polui a lista de quem realmente precisa de ação.
    if (!a || !a.is_active) continue;

    const daysLate = daysBetween(c.due_date, todayISO);
    const net = c.amount_cents - (c.discount_cents ?? 0);

    const existing = byAthlete.get(c.athlete_id);
    const charge: OverdueCharge = {
      id: c.id,
      description: c.description,
      amountCents: net,
      dueDate: c.due_date,
      daysLate,
    };

    if (existing) {
      existing.charges.push(charge);
      existing.totalCents += net;
      existing.maxDaysLate = Math.max(existing.maxDaysLate, daysLate);
      existing.bucket = bucketFor(existing.maxDaysLate);
    } else {
      byAthlete.set(c.athlete_id, {
        athleteId: c.athlete_id,
        fullName: a.full_name,
        guardianName: a.guardian_name,
        guardianPhone: a.guardian_phone,
        guardianEmail: a.guardian_email,
        charges: [charge],
        totalCents: net,
        maxDaysLate: daysLate,
        bucket: bucketFor(daysLate),
      });
    }
  }

  return [...byAthlete.values()].sort((x, y) => y.maxDaysLate - x.maxDaysLate);
}
