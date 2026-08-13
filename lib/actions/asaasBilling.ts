"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { getClubAsaasCredentials } from "@/lib/asaas/credentials";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import {
  AsaasError,
  getMyAccount,
  findCustomerByCpf,
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscriptionPaymentLink,
} from "@/lib/asaas/client";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function isValidCpf(cpf: string) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export async function testAsaasConnection(): Promise<
  { success: true; name: string; email: string } | { success: false; error: string }
> {
  const coach = await requireCoach();
  try {
    const creds = await getClubAsaasCredentials(coach.clubId);
    if (!creds) return { success: false, error: "Este clube ainda não conectou uma conta Asaas." };
    const account = await getMyAccount(creds);
    return { success: true, name: account.name, email: account.email };
  } catch (e) {
    if (e instanceof AsaasError) return { success: false, error: e.message };
    return { success: false, error: "Não foi possível conectar ao Asaas." };
  }
}

const guardianInfoSchema = z.object({
  athleteId: z.string().uuid(),
  cpf: z.string().refine(isValidCpf, "CPF inválido."),
  email: z.string().trim().email("E-mail inválido."),
});

export async function updateGuardianBillingInfo(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = guardianInfoSchema.safeParse({
    athleteId: formData.get("athleteId"),
    cpf: formData.get("cpf"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({ guardian_cpf: onlyDigits(parsed.data.cpf), guardian_email: parsed.data.email })
    .eq("id", parsed.data.athleteId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath(`/athletes/${parsed.data.athleteId}/financeiro`);
  return { success: true };
}

const recurringSchema = z.object({
  athleteId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.string().min(1, "Informe o valor."),
  billingType: z.enum(["CREDIT_CARD", "PIX", "BOLETO", "UNDEFINED"]),
  nextDueDate: z.string().min(1, "Informe o primeiro vencimento."),
});

export async function createRecurringBilling(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = recurringSchema.safeParse({
    athleteId: formData.get("athleteId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    billingType: formData.get("billingType"),
    nextDueDate: formData.get("nextDueDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Valor inválido." };
  }

  const supabase = await createClient();
  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("full_name, guardian_name, guardian_cpf, guardian_email, asaas_customer_id")
    .eq("id", parsed.data.athleteId)
    .eq("club_id", coach.clubId)
    .single();
  if (athleteError || !athlete) return { error: "Atleta não encontrado." };
  if (!athlete.guardian_cpf || !athlete.guardian_email) {
    return { error: "Cadastre CPF e e-mail do responsável financeiro antes de configurar." };
  }

  try {
    // A credencial é resolvida a cada operação, não guardada em módulo: é
    // o que garante que a cobrança vá pra conta do clube certo.
    const creds = await getClubAsaasCredentials(coach.clubId);
    if (!creds) return { error: "Conecte a conta Asaas do clube em Configurações antes de cobrar." };

    let customerId = athlete.asaas_customer_id;
    if (!customerId) {
      const existing = await findCustomerByCpf(creds, athlete.guardian_cpf);
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await createCustomer(creds, {
          name: athlete.guardian_name || athlete.full_name,
          cpfCnpj: athlete.guardian_cpf,
          email: athlete.guardian_email,
          externalReference: parsed.data.athleteId,
        });
        customerId = created.id;
      }
      await supabase
        .from("athletes")
        .update({ asaas_customer_id: customerId })
        .eq("id", parsed.data.athleteId);
    }

    const subscription = await createSubscription(creds, {
      customer: customerId,
      billingType: parsed.data.billingType,
      value: amountValue,
      nextDueDate: parsed.data.nextDueDate,
      cycle: "MONTHLY",
      description: parsed.data.description,
    });

    const checkoutUrl = await getSubscriptionPaymentLink(creds, subscription.id).catch(() => null);

    const { error: insertError } = await supabase.from("athlete_billing_subscriptions").insert({
      club_id: coach.clubId,
      athlete_id: parsed.data.athleteId,
      asaas_subscription_id: subscription.id,
      billing_type: parsed.data.billingType,
      amount_cents: Math.round(amountValue * 100),
      description: parsed.data.description,
      checkout_url: checkoutUrl,
      created_by: coach.userId,
    });
    if (insertError) return { error: insertError.message };
  } catch (e) {
    if (e instanceof AsaasError) return { error: e.message };
    return { error: "Não foi possível criar a assinatura no Asaas." };
  }

  revalidatePath(`/athletes/${parsed.data.athleteId}/financeiro`);
  return { success: true };
}

export async function cancelRecurringBilling(
  subscriptionRowId: string,
  asaasSubscriptionId: string,
  athleteId: string,
): Promise<ActionResult> {
  const coach = await requireCoach();
  try {
    const creds = await getClubAsaasCredentials(coach.clubId);
    if (creds) await cancelSubscription(creds, asaasSubscriptionId);
  } catch (e) {
    if (e instanceof AsaasError && e.status !== 404) return { error: e.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_billing_subscriptions")
    .update({ status: "INACTIVE" })
    .eq("id", subscriptionRowId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath(`/athletes/${athleteId}/financeiro`);
  return { success: true };
}
