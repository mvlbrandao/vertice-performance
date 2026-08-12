"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/auditLog";
import type { ActionResult } from "@/lib/actions/athletes";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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

  const [{ data: charges }, { data: expenses }, { data: movements }] = await Promise.all([
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
    supabase
      .from("cash_movements")
      .select("type, amount_cents")
      .eq("club_id", coach.clubId)
      .eq("movement_date", closureDate),
  ]);

  const movementIncome = (movements ?? [])
    .filter((m) => m.type === "entrada")
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const movementExpense = (movements ?? [])
    .filter((m) => m.type === "saida")
    .reduce((sum, m) => sum + m.amount_cents, 0);

  const incomeCents =
    (charges ?? []).reduce((sum, c) => sum + (c.amount_cents - c.discount_cents), 0) +
    movementIncome;
  const expenseCents = (expenses ?? []).reduce((sum, e) => sum + e.amount_cents, 0) + movementExpense;

  const { error } = await supabase.from("daily_cash_closures").upsert(
    {
      club_id: coach.clubId,
      closure_date: closureDate,
      income_cents: incomeCents,
      expense_cents: expenseCents,
      balance_cents: incomeCents - expenseCents,
      income_count: (charges?.length ?? 0) + (movements ?? []).filter((m) => m.type === "entrada").length,
      expense_count: (expenses?.length ?? 0) + (movements ?? []).filter((m) => m.type === "saida").length,
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

export async function reopenCashRegister(closureDate: string, reason?: string): Promise<ActionResult> {
  const coach = await requireCoach();

  // Depois que o dia vira, reabrir exige justificativa — é uma correção
  // excepcional, não parte do fluxo normal do dia.
  if (closureDate < todayISO() && !reason?.trim()) {
    return { error: "Informe o motivo para reabrir o caixa de um dia anterior." };
  }

  const supabase = await createClient();
  const { data: closure } = await supabase
    .from("daily_cash_closures")
    .select("id, closed_by_name, closed_at")
    .eq("club_id", coach.clubId)
    .eq("closure_date", closureDate)
    .single();
  if (!closure) return { error: "Caixa não encontrado." };

  const { error } = await supabase
    .from("daily_cash_closures")
    .delete()
    .eq("club_id", coach.clubId)
    .eq("closure_date", closureDate);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "cash_closure",
    entityId: closure.id,
    action: "reopen",
    details: {
      closure_date: closureDate,
      originally_closed_by: closure.closed_by_name,
      originally_closed_at: closure.closed_at,
      reason: reason?.trim() || null,
    },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

  revalidatePath("/caixa-do-dia");
  revalidatePath("/auditoria");
  return { success: true };
}

const movementSchema = z.object({
  movementDate: z.string().min(1),
  type: z.enum(["entrada", "saida"]),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
});

export async function createCashMovement(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = movementSchema.safeParse({
    movementDate: formData.get("movementDate"),
    type: formData.get("type"),
    description: formData.get("description"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Valor inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cash_movements").insert({
    club_id: coach.clubId,
    movement_date: parsed.data.movementDate,
    type: parsed.data.type,
    description: parsed.data.description,
    amount_cents: Math.round(amountValue * 100),
    created_by: coach.userId,
    created_by_name: coach.fullName,
  });
  if (error) return { error: error.message };

  revalidatePath("/caixa-do-dia");
  return { success: true };
}

export async function deleteCashMovement(movementId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_movements")
    .delete()
    .eq("id", movementId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/caixa-do-dia");
  return { success: true };
}
