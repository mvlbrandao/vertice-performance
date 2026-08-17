import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { AGING_BUCKETS, bucketFor, daysBetween } from "@/lib/billing/overdue";

export interface ClubOverdue {
  clubId: string;
  totalCents: number;
  maxDaysLate: number;
  bucket: string;
}

export interface PlatformBillingOverview {
  recebidoMesCents: number;
  aReceber7DiasCents: number;
  overdueByClub: Map<string, ClubOverdue>;
}

/**
 * Mesma régua de app/(coach)/inadimplencia (lib/billing/overdue.ts), um
 * nível acima: em vez de responsável atrasado com o clube, é clube
 * atrasado com a plataforma. Reaproveita AGING_BUCKETS/bucketFor pra não
 * inventar uma segunda régua com faixas diferentes.
 */
export async function getPlatformBillingOverview(
  admin: SupabaseClient<Database>,
  todayISO: string,
  weekAheadISO: string,
  monthStartISO: string,
): Promise<PlatformBillingOverview> {
  const [{ data: paidThisMonth }, { data: dueThisWeek }, { data: overdueCharges }] = await Promise.all([
    admin
      .from("platform_charges")
      .select("amount_cents")
      .eq("status", "Pago")
      .gte("paid_at", monthStartISO),
    admin
      .from("platform_charges")
      .select("amount_cents")
      .eq("status", "Pendente")
      .gte("due_date", todayISO)
      .lte("due_date", weekAheadISO),
    admin
      .from("platform_charges")
      .select("club_id, amount_cents, due_date")
      .in("status", ["Pendente", "Atrasado"])
      .lt("due_date", todayISO),
  ]);

  const recebidoMesCents = (paidThisMonth ?? []).reduce((sum, c) => sum + c.amount_cents, 0);
  const aReceber7DiasCents = (dueThisWeek ?? []).reduce((sum, c) => sum + c.amount_cents, 0);

  const overdueByClub = new Map<string, ClubOverdue>();
  for (const c of overdueCharges ?? []) {
    const daysLate = daysBetween(c.due_date, todayISO);
    const existing = overdueByClub.get(c.club_id);
    if (existing) {
      existing.totalCents += c.amount_cents;
      existing.maxDaysLate = Math.max(existing.maxDaysLate, daysLate);
      existing.bucket = bucketFor(existing.maxDaysLate);
    } else {
      overdueByClub.set(c.club_id, {
        clubId: c.club_id,
        totalCents: c.amount_cents,
        maxDaysLate: daysLate,
        bucket: bucketFor(daysLate),
      });
    }
  }

  return { recebidoMesCents, aReceber7DiasCents, overdueByClub };
}

export { AGING_BUCKETS };
