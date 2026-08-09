"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import type { ChargeStatus } from "@/lib/types/database";

function paths() {
  revalidatePath("/contas-a-pagar");
  revalidatePath("/dashboard");
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
});

export async function createExpenseCategory(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
  });
  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: error.message };
  }

  paths();
  return { success: true };
}

export async function deleteExpenseCategory(categoryId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .delete()
    .eq("id", categoryId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

const expenseSchema = z.object({
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
  dueDate: z.string().min(1, "Informe o vencimento."),
  notes: z.string().trim().optional(),
});

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = expenseSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Valor inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    club_id: coach.clubId,
    category_id: parsed.data.categoryId || null,
    description: parsed.data.description,
    amount_cents: Math.round(amountValue * 100),
    due_date: parsed.data.dueDate,
    notes: parsed.data.notes || null,
    created_by: coach.userId,
  });
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

export async function setExpenseStatus(
  expenseId: string,
  status: ChargeStatus,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      status,
      paid_at: status === "Pago" ? new Date().toISOString() : null,
    })
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

export async function updateExpenseDueDate(
  expenseId: string,
  dueDate: string,
): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!dueDate) return { error: "Informe uma data válida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ due_date: dueDate })
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}
