"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const closeSchema = z.object({
  closureDate: z.string().min(1),
  notes: z.string().trim().optional(),
});

export async function closeCashRegister(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = closeSchema.safeParse({
    closureDate: formData.get("closureDate"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Data inválida." };
  }
  const { closureDate } = parsed.data;

  const supabase = await createClient();
  const dayStart = closureDate;
  const dayEnd = `${closureDate}T23:59:59`;

  const [{ data: charges }, { data: expenses }] = await Promise.all([
    supabase
      .from("athlete_charges")
      .select("amount_cents, discount_cents")
      .eq("club_id", coach.clubId)
      .eq("status", "Pago")
      .gte("paid_at", dayStart)
      .lte("paid_at", dayEnd),
    supabase
      .from("expenses")
      .select("amount_cents")
      .eq("club_id", coach.clubId)
      .eq("status", "Pago")
      .gte("paid_at", dayStart)
      .lte("paid_at", dayEnd),
  ]);

  const incomeCents = (charges ?? []).reduce(
    (sum, c) => sum + (c.amount_cents - c.discount_cents),
    0,
  );
  const expenseCents = (expenses ?? []).reduce((sum, e) => sum + e.amount_cents, 0);

  const { error } = await supabase.from("daily_cash_closures").upsert(
    {
      club_id: coach.clubId,
      closure_date: closureDate,
      income_cents: incomeCents,
      expense_cents: expenseCents,
      balance_cents: incomeCents - expenseCents,
      income_count: charges?.length ?? 0,
      expense_count: expenses?.length ?? 0,
      notes: parsed.data.notes || null,
      closed_by: coach.userId,
      closed_by_name: coach.fullName,
      closed_at: new Date().toISOString(),
    },
    { onConflict: "club_id,closure_date" },
  );
  if (error) return { error: error.message };

  revalidatePath("/caixa-do-dia");
  return { success: true };
}

export async function reopenCashRegister(closureDate: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_cash_closures")
    .delete()
    .eq("club_id", coach.clubId)
    .eq("closure_date", closureDate);
  if (error) return { error: error.message };

  revalidatePath("/caixa-do-dia");
  return { success: true };
}
