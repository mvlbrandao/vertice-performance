"use server";

/**
 * Lançamentos financeiros (mensalidade) por atleta. Cobrança recorrente
 * com cartão/PIX automático fica fora daqui de propósito: exige uma conta
 * real num gateway de pagamento (ex.: Asaas, Mercado Pago) com chave de API
 * do clube, e a coleta do cartão tem que acontecer no checkout hospedado do
 * próprio provedor — nunca num formulário nosso. Esse módulo cobre a parte
 * que dá pra fazer sem isso: o controle manual de quem pagou o quê.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/auditLog";
import type { ActionResult } from "@/lib/actions/athletes";
import type { ChargeStatus } from "@/lib/types/database";
import { sendChargePaidEmail } from "@/lib/email/send";

function paths(athleteId: string) {
  revalidatePath(`/athletes/${athleteId}/financeiro`);
  revalidatePath("/financeiro");
  revalidatePath("/contas-a-receber");
  revalidatePath("/dashboard");
}

const chargeSchema = z.object({
  athleteId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
  discount: z.string().optional(),
  competenceMonth: z.string().min(1),
  competenceYear: z.string().min(1),
  dueDate: z.string().min(1, "Informe o vencimento."),
  installments: z.string().min(1),
});

function addMonthsToISODate(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

function addMonthsToCompetence(month: number, year: number, months: number) {
  const total = month - 1 + months;
  return { month: (((total % 12) + 12) % 12) + 1, year: year + Math.floor(total / 12) };
}

export async function createCharge(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = chargeSchema.safeParse({
    athleteId: formData.get("athleteId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    discount: formData.get("discount") || "",
    competenceMonth: formData.get("competenceMonth"),
    competenceYear: formData.get("competenceYear"),
    dueDate: formData.get("dueDate"),
    installments: formData.get("installments") || "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Valor inválido." };
  }
  const discountValue = parsed.data.discount
    ? Number(parsed.data.discount.replace(",", "."))
    : 0;
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Desconto inválido." };
  }
  if (discountValue >= amountValue) {
    return { error: "O desconto não pode ser maior ou igual ao valor do lançamento." };
  }

  const installmentsCount = Math.min(Math.max(Number(parsed.data.installments) || 1, 1), 36);
  const baseMonth = Number(parsed.data.competenceMonth);
  const baseYear = Number(parsed.data.competenceYear);

  const rows = Array.from({ length: installmentsCount }, (_, i) => {
    const competence = addMonthsToCompetence(baseMonth, baseYear, i);
    return {
      club_id: coach.clubId,
      athlete_id: parsed.data.athleteId,
      description:
        installmentsCount > 1
          ? `${parsed.data.description} (${i + 1}/${installmentsCount})`
          : parsed.data.description,
      amount_cents: Math.round(amountValue * 100),
      discount_cents: Math.round(discountValue * 100),
      competence_month: competence.month,
      competence_year: competence.year,
      due_date: addMonthsToISODate(parsed.data.dueDate, i),
      created_by: coach.userId,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("athlete_charges").insert(rows);
  if (error) return { error: error.message };

  paths(parsed.data.athleteId);
  return { success: true };
}

export async function setChargeStatus(
  chargeId: string,
  athleteId: string,
  status: ChargeStatus,
): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("athlete_charges")
    .select("status, description, amount_cents")
    .eq("id", chargeId)
    .eq("club_id", coach.clubId)
    .single();
  const { error } = await supabase
    .from("athlete_charges")
    .update({
      status,
      paid_at: status === "Pago" ? new Date().toISOString() : null,
    })
    .eq("id", chargeId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "charge",
    entityId: chargeId,
    action: "status_change",
    details: { from: previous?.status ?? null, to: status },
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId,
  });

  if (status === "Pago" && previous && previous.status !== "Pago") {
    const { data: athlete } = await supabase
      .from("athletes")
      .select("full_name, guardian_email")
      .eq("id", athleteId)
      .single();
    if (athlete?.guardian_email) {
      await sendChargePaidEmail({
        to: athlete.guardian_email,
        athleteName: athlete.full_name,
        description: previous.description,
        amountCents: previous.amount_cents,
      });
    }
  }

  paths(athleteId);
  return { success: true };
}

export async function updateChargeDueDate(
  chargeId: string,
  athleteId: string,
  dueDate: string,
): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!dueDate) return { error: "Informe uma data válida." };
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("athlete_charges")
    .select("due_date")
    .eq("id", chargeId)
    .eq("club_id", coach.clubId)
    .single();
  const { error } = await supabase
    .from("athlete_charges")
    .update({ due_date: dueDate })
    .eq("id", chargeId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  await logAudit({
    clubId: coach.clubId,
    entityType: "charge",
    entityId: chargeId,
    action: "due_date_change",
    details: { from: previous?.due_date ?? null, to: dueDate },
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId,
  });

  paths(athleteId);
  return { success: true };
}

export async function deleteCharge(chargeId: string, athleteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_charges")
    .delete()
    .eq("id", chargeId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths(athleteId);
  return { success: true };
}
