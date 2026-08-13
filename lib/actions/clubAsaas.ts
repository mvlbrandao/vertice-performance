"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyAccount, AsaasError } from "@/lib/asaas/client";
import {
  baseUrlForKey,
  isSandboxKey,
  saveClubAsaasCredentials,
  disconnectClubAsaas,
  getClubAsaasCredentials,
} from "@/lib/asaas/credentials";
import { logAudit } from "@/lib/actions/auditLog";
import type { ActionResult } from "@/lib/actions/athletes";

const connectSchema = z.object({
  apiKey: z.string().trim().min(20, "Chave muito curta — confira se copiou inteira."),
});

export interface ConnectResult extends ActionResult {
  accountName?: string;
  sandbox?: boolean;
  webhookUrl?: string;
}

/**
 * Conecta a conta Asaas do clube.
 *
 * Valida contra o Asaas antes de gravar: erro de digitação só apareceria na
 * primeira cobrança de verdade, quando já é tarde e o responsável é quem
 * sente. Com a validação, o clube vê na hora o nome da conta que conectou —
 * é assim que ele confirma que é a conta certa, e não a de outra empresa.
 */
export async function connectClubAsaas(formData: FormData): Promise<ConnectResult> {
  const coach = await requireCoach();
  const parsed = connectSchema.safeParse({ apiKey: formData.get("apiKey") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Chave inválida." };
  }

  const apiKey = parsed.data.apiKey;
  const creds = { apiKey, baseUrl: baseUrlForKey(apiKey) };

  let accountName: string;
  try {
    const account = await getMyAccount(creds);
    accountName = account.name;
  } catch (e) {
    if (e instanceof AsaasError) {
      return { error: `O Asaas recusou essa chave: ${e.message}` };
    }
    return { error: "Não foi possível falar com o Asaas. Tente de novo em alguns minutos." };
  }

  const webhookToken = await saveClubAsaasCredentials(coach.clubId, apiKey);

  const admin = createAdminClient();
  await admin
    .from("clubs")
    .update({ asaas_account_name: accountName, asaas_connected_at: new Date().toISOString() })
    .eq("id", coach.clubId);

  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: coach.clubId,
    action: "grant",
    details: { asaas: "conectado", conta: accountName, sandbox: isSandboxKey(apiKey) },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

  revalidatePath("/config");
  return {
    success: true,
    accountName,
    sandbox: isSandboxKey(apiKey),
    webhookUrl: `/api/webhooks/asaas/${webhookToken}`,
  };
}

export async function disconnectClubAsaasAction(): Promise<ActionResult> {
  const coach = await requireCoach();
  await disconnectClubAsaas(coach.clubId);

  const admin = createAdminClient();
  await admin
    .from("clubs")
    .update({ asaas_account_name: null, asaas_connected_at: null })
    .eq("id", coach.clubId);

  await logAudit({
    clubId: coach.clubId,
    entityType: "access",
    entityId: coach.clubId,
    action: "revoke",
    details: { asaas: "desconectado" },
    performedBy: coach.userId,
    performedByName: coach.fullName,
  });

  revalidatePath("/config");
  return { success: true };
}

/** Reconfere a conexão e devolve o endereço de webhook pra copiar. */
export async function getClubAsaasStatus(): Promise<{
  connected: boolean;
  sandbox?: boolean;
  webhookPath?: string;
  error?: string;
}> {
  const coach = await requireCoach();
  const creds = await getClubAsaasCredentials(coach.clubId);
  if (!creds) return { connected: false };

  const admin = createAdminClient();
  const { data } = await admin
    .from("club_asaas_credentials")
    .select("webhook_token")
    .eq("club_id", coach.clubId)
    .maybeSingle();

  try {
    await getMyAccount(creds);
  } catch (e) {
    return {
      connected: true,
      sandbox: isSandboxKey(creds.apiKey),
      webhookPath: data ? `/api/webhooks/asaas/${data.webhook_token}` : undefined,
      error: e instanceof AsaasError ? e.message : "Não foi possível validar a conexão agora.",
    };
  }

  return {
    connected: true,
    sandbox: isSandboxKey(creds.apiKey),
    webhookPath: data ? `/api/webhooks/asaas/${data.webhook_token}` : undefined,
  };
}
