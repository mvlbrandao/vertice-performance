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
import type { ActionResult } from "@/lib/actions/athletes";
import type { ChargeStatus } from "@/lib/types/database";

function paths(athleteId: string) {
  revalidatePath(`/athletes/${athleteId}/financeiro`);
  revalidatePath("/financeiro");
}

const chargeSchema = z.object({
  athleteId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
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
  const { error } = await supabase
    .from("athlete_charges")
    .update({
      status,
      paid_at: status === "Pago" ? new Date().toISOString() : null,
    })
    .eq("id", chargeId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

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
