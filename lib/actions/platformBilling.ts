"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAsaasCredentials } from "@/lib/asaas/platform";
import { hojeISO } from "@/lib/utils/date";
import type { ActionResult } from "@/lib/actions/athletes";
import {
  AsaasError,
  findCustomerByCpf,
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscriptionPaymentLink,
} from "@/lib/asaas/client";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function isValidCpfOrCnpj(v: string) {
  const digits = onlyDigits(v);
  return digits.length === 11 || digits.length === 14;
}

const startSchema = z.object({
  clubId: z.string().uuid(),
  cpfCnpj: z.string().refine(isValidCpfOrCnpj, "CPF/CNPJ inválido."),
  amountReais: z.string().min(1, "Informe o valor."),
  billingType: z.enum(["CREDIT_CARD", "PIX", "BOLETO", "UNDEFINED"]),
});

/**
 * Liga a cobrança recorrente do clube pela plataforma (nós cobrando o
 * clube), na conta Asaas da própria plataforma — não confundir com
 * lib/actions/asaasBilling.ts, que é o clube cobrando os responsáveis na
 * conta Asaas dele. clubs.asaas_customer_id/subscription_id existiam desde
 * o ciclo de vida do clube, reservados exatamente pra isso.
 */
export async function startClubSubscription(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = startSchema.safeParse({
    clubId: formData.get("clubId"),
    cpfCnpj: formData.get("cpfCnpj"),
    amountReais: formData.get("amountReais"),
    billingType: formData.get("billingType"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const amountValue = Number(parsed.data.amountReais.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) return { error: "Valor inválido." };

  const admin = createAdminClient();

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id, name, owner_profile_id, asaas_customer_id")
    .eq("id", parsed.data.clubId)
    .maybeSingle();
  if (clubError || !club) return { error: "Clube não encontrado." };
  if (!club.owner_profile_id) return { error: "Este clube não tem responsável definido (owner_profile_id)." };

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", club.owner_profile_id)
    .maybeSingle();

  // E-mail só existe em auth.users — profiles não guarda e-mail.
  const { data: ownerUser } = await admin.auth.admin.getUserById(club.owner_profile_id);

  const creds = getPlatformAsaasCredentials();
  if (!creds) return { error: "ASAAS_API_KEY da plataforma não configurada no ambiente." };

  const cpfCnpj = onlyDigits(parsed.data.cpfCnpj);

  try {
    let customerId = club.asaas_customer_id;
    if (!customerId) {
      const existing = await findCustomerByCpf(creds, cpfCnpj);
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await createCustomer(creds, {
          name: ownerProfile?.full_name || club.name,
          cpfCnpj,
          email: ownerUser?.user?.email ?? undefined,
          externalReference: club.id,
        });
        customerId = created.id;
      }
    }

    const subscription = await createSubscription(creds, {
      customer: customerId,
      billingType: parsed.data.billingType,
      value: amountValue,
      nextDueDate: hojeISO(),
      cycle: "MONTHLY",
      description: `Assinatura Vértice — ${club.name}`,
    });

    const checkoutUrl = await getSubscriptionPaymentLink(creds, subscription.id).catch(() => null);

    const { error: updateError } = await admin
      .from("clubs")
      .update({
        billing_cpf_cnpj: cpfCnpj,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
        asaas_checkout_url: checkoutUrl,
      })
      .eq("id", club.id);
    if (updateError) return { error: updateError.message };

    revalidatePath("/plataforma");
    return { success: true };
  } catch (e) {
    if (e instanceof AsaasError) return { error: e.message };
    return { error: "Não foi possível criar a assinatura no Asaas." };
  }
}

const cancelSchema = z.object({ clubId: z.string().uuid() });

export async function cancelClubSubscription(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = cancelSchema.safeParse({ clubId: formData.get("clubId") });
  if (!parsed.success) return { error: "Clube inválido." };

  const admin = createAdminClient();
  const { data: club } = await admin
    .from("clubs")
    .select("asaas_subscription_id")
    .eq("id", parsed.data.clubId)
    .maybeSingle();

  if (club?.asaas_subscription_id) {
    const creds = getPlatformAsaasCredentials();
    try {
      if (creds) await cancelSubscription(creds, club.asaas_subscription_id);
    } catch (e) {
      if (e instanceof AsaasError && e.status !== 404) return { error: e.message };
    }
  }

  await admin.from("clubs").update({ asaas_checkout_url: null }).eq("id", parsed.data.clubId);

  revalidatePath("/plataforma");
  return { success: true };
}
