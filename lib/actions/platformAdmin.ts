"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { somaDias, hojeISO } from "@/lib/utils/date";
import type { ActionResult } from "@/lib/actions/athletes";
import type { Database } from "@/lib/types/database";

const settingsSchema = z.object({
  planName: z.string().trim().min(1, "Informe o nome do plano."),
  priceReais: z.string(),
  trialDays: z.coerce.number().int().min(0).max(365),
  maxAthletes: z.coerce.number().int().min(1).max(100000),
  retentionDays: z.coerce.number().int().min(1).max(3650),
});

/** Aceita "149,90" e "149.90" — o treinador digita com vírgula. */
function reaisParaCentavos(raw: string): number | null {
  const n = Number(raw.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function updatePlatformSettings(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = settingsSchema.safeParse({
    planName: formData.get("planName"),
    priceReais: formData.get("priceReais"),
    trialDays: formData.get("trialDays"),
    maxAthletes: formData.get("maxAthletes"),
    retentionDays: formData.get("retentionDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const priceCents = reaisParaCentavos(parsed.data.priceReais);
  if (priceCents === null) return { error: "Valor inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .update({
      plan_name: parsed.data.planName,
      price_cents: priceCents,
      trial_days: parsed.data.trialDays,
      max_athletes: parsed.data.maxAthletes,
      retention_days: parsed.data.retentionDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}

const clubActionSchema = z.object({
  clubId: z.string().uuid(),
});

/** Estende o teste em N dias a partir de hoje (ou do vencimento, se ainda houver). */
export async function extendTrial(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const clubId = clubActionSchema.safeParse({ clubId: formData.get("clubId") });
  if (!clubId.success) return { error: "Clube inválido." };
  const dias = Number(formData.get("dias") ?? 15);
  if (!Number.isFinite(dias) || dias < 1 || dias > 365) return { error: "Prazo inválido." };

  const admin = createAdminClient();
  const { data: club } = await admin
    .from("clubs")
    .select("trial_ends_at")
    .eq("id", clubId.data.clubId)
    .maybeSingle();

  // Estende a partir do vencimento quando ele ainda está no futuro, senão
  // a partir de hoje — prorrogar um teste vencido há um mês não pode
  // devolver um prazo que já nasce no passado.
  const base =
    club?.trial_ends_at && new Date(club.trial_ends_at) > new Date()
      ? club.trial_ends_at.slice(0, 10)
      : hojeISO();

  const { error } = await admin
    .from("clubs")
    .update({ status: "trial", trial_ends_at: `${somaDias(base, dias)}T23:59:59Z` })
    .eq("id", clubId.data.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}

const courtesySchema = z.object({
  clubId: z.string().uuid(),
  ate: z.string().min(1, "Informe até quando vale a cortesia."),
  motivo: z.string().trim().optional(),
});

/** Bonificação: libera o clube sem cobrança até uma data. */
export async function grantCourtesy(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = courtesySchema.safeParse({
    clubId: formData.get("clubId"),
    ate: formData.get("ate"),
    motivo: formData.get("motivo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("clubs")
    .update({
      courtesy_until: `${parsed.data.ate}T23:59:59Z`,
      courtesy_reason: parsed.data.motivo || null,
    })
    .eq("id", parsed.data.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}

export async function revokeCourtesy(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = clubActionSchema.safeParse({ clubId: formData.get("clubId") });
  if (!parsed.success) return { error: "Clube inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("clubs")
    .update({ courtesy_until: null, courtesy_reason: null })
    .eq("id", parsed.data.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}

const overrideSchema = z.object({
  clubId: z.string().uuid(),
  maxAthletes: z.string().optional(),
  priceReais: z.string().optional(),
});

/** Cota e preço próprios deste clube. Vazio volta ao padrão do plano. */
export async function setClubOverrides(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = overrideSchema.safeParse({
    clubId: formData.get("clubId"),
    maxAthletes: formData.get("maxAthletes") ?? "",
    priceReais: formData.get("priceReais") ?? "",
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const cota = parsed.data.maxAthletes?.trim();
  const preco = parsed.data.priceReais?.trim();

  const maxOverride = cota ? Number(cota) : null;
  if (maxOverride !== null && (!Number.isInteger(maxOverride) || maxOverride < 1)) {
    return { error: "Cota inválida." };
  }
  const precoOverride = preco ? reaisParaCentavos(preco) : null;
  if (preco && precoOverride === null) return { error: "Valor inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("clubs")
    .update({ max_athletes_override: maxOverride, price_cents_override: precoOverride })
    .eq("id", parsed.data.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}

const statusSchema = z.object({
  clubId: z.string().uuid(),
  status: z.enum(["trial", "ativo", "atrasado", "bloqueado", "cancelado"]),
});

export async function setClubStatus(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const parsed = statusSchema.safeParse({
    clubId: formData.get("clubId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Situação inválida." };

  const admin = createAdminClient();

  // Voltar pra 'trial' sem prazo violaria a restrição do banco, então damos
  // um prazo padrão; e cancelar registra a data, que é o que dispara a
  // contagem de retenção antes do expurgo.
  const patch: Database["public"]["Tables"]["clubs"]["Update"] = { status: parsed.data.status };
  if (parsed.data.status === "trial") {
    patch.trial_ends_at = `${somaDias(hojeISO(), 15)}T23:59:59Z`;
  }
  if (parsed.data.status === "cancelado") {
    patch.canceled_at = new Date().toISOString();
  } else {
    patch.canceled_at = null;
  }

  const { error } = await admin.from("clubs").update(patch).eq("id", parsed.data.clubId);
  if (error) return { error: error.message };

  revalidatePath("/plataforma");
  return { success: true };
}
