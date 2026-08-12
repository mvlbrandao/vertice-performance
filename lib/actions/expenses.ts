"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/auditLog";
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
  const { data: category } = await supabase
    .from("expense_categories")
    .select("is_locked")
    .eq("id", categoryId)
    .eq("club_id", coach.clubId)
    .single();
  if (category?.is_locked) {
    return {
      error:
        "Essa categoria é usada para vincular despesas a profissionais e não pode ser excluída.",
    };
  }

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
  professionalId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
  dueDate: z.string().min(1, "Informe o vencimento."),
  notes: z.string().trim().optional(),
  installments: z.string().min(1).optional(),
});

function addMonthsToISODate(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

async function requireProfessionalIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  professionalId: string,
): Promise<string | null> {
  if (!categoryId) return null;
  const { data: category } = await supabase
    .from("expense_categories")
    .select("requires_professional")
    .eq("id", categoryId)
    .single();
  if (category?.requires_professional && !professionalId) {
    return "Selecione o profissional para uma despesa de Salários e comissão técnica.";
  }
  return null;
}

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = expenseSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    professionalId: formData.get("professionalId") ?? "",
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") ?? "",
    installments: formData.get("installments") || "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Valor inválido." };
  }

  const supabase = await createClient();
  const professionalError = await requireProfessionalIfNeeded(
    supabase,
    parsed.data.categoryId ?? "",
    parsed.data.professionalId ?? "",
  );
  if (professionalError) return { error: professionalError };

  const installmentsCount = Math.min(
    Math.max(Number(parsed.data.installments) || 1, 1),
    36,
  );
  const rows = Array.from({ length: installmentsCount }, (_, i) => ({
    club_id: coach.clubId,
    category_id: parsed.data.categoryId || null,
    professional_id: parsed.data.professionalId || null,
    description:
      installmentsCount > 1
        ? `${parsed.data.description} (${i + 1}/${installmentsCount})`
        : parsed.data.description,
    amount_cents: Math.round(amountValue * 100),
    due_date: addMonthsToISODate(parsed.data.dueDate, i),
    notes: parsed.data.notes || null,
    created_by: coach.userId,
  }));

  const { error } = await supabase.from("expenses").insert(rows);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

const editExpenseSchema = z.object({
  categoryId: z.string().uuid().optional().or(z.literal("")),
  professionalId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
  notes: z.string().trim().optional(),
});

export async function updateExpense(expenseId: string, formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = editExpenseSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    professionalId: formData.get("professionalId") ?? "",
    description: formData.get("description"),
    amount: formData.get("amount"),
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
  const professionalError = await requireProfessionalIfNeeded(
    supabase,
    parsed.data.categoryId ?? "",
    parsed.data.professionalId ?? "",
  );
  if (professionalError) return { error: professionalError };

  const { data: previous } = await supabase
    .from("expenses")
    .select("description, amount_cents, category_id, notes")
    .eq("id", expenseId)
    .eq("club_id", coach.clubId)
    .single();

  const nextAmountCents = Math.round(amountValue * 100);
  const { error } = await supabase
    .from("expenses")
    .update({
      description: parsed.data.description,
      amount_cents: nextAmountCents,
      category_id: parsed.data.categoryId || null,
      professional_id: parsed.data.professionalId || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "expense",
    entityId: expenseId,
    action: "edit",
    details: {
      from: previous ?? null,
      to: {
        description: parsed.data.description,
        amount_cents: nextAmountCents,
        category_id: parsed.data.categoryId || null,
        notes: parsed.data.notes || null,
      },
    },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

  paths();
  return { success: true };
}

export async function setExpenseStatus(
  expenseId: string,
  status: ChargeStatus,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("expenses")
    .select("status")
    .eq("id", expenseId)
    .eq("club_id", coach.clubId)
    .single();
  const { error } = await supabase
    .from("expenses")
    .update({
      status,
      paid_at: status === "Pago" ? new Date().toISOString() : null,
    })
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "expense",
    entityId: expenseId,
    action: "status_change",
    details: { from: previous?.status ?? null, to: status },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

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
  const { data: previous } = await supabase
    .from("expenses")
    .select("due_date")
    .eq("id", expenseId)
    .eq("club_id", coach.clubId)
    .single();
  const { error } = await supabase
    .from("expenses")
    .update({ due_date: dueDate })
    .eq("id", expenseId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "expense",
    entityId: expenseId,
    action: "due_date_change",
    details: { from: previous?.due_date ?? null, to: dueDate },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

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
