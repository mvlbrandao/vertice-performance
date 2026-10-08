"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { logPlatformAction } from "@/lib/platform/audit";
import { successResult, type PlatformActionResult } from "@/lib/platform/auditNotice";
import { revalidateAdmin } from "@/lib/platform/revalidate";
import { diffFields } from "@/lib/actions/auditLog";
import { somaDias, hojeISO } from "@/lib/utils/date";
import type { Database } from "@/lib/types/database";

const settingsSchema = z.object({
  planName: z.string().trim().min(1, "Informe o nome do plano."),
  priceReais: z.string(),
  trialDays: z.coerce.number().int().min(0).max(365),
  maxAthletes: z.coerce.number().int().min(1).max(100000),
  retentionDays: z.coerce.number().int().min(1).max(3650),
});

/**
 * Retrato do clube antes de uma mutação: dá o nome para a trilha de auditoria
 * e os valores "de" do diff. Quem muda um clube que não existe recebe erro em
 * vez de um sucesso que não alterou nada.
 */
const CLUB_SNAPSHOT_COLUMNS =
  "id, name, status, trial_ends_at, courtesy_until, courtesy_reason, max_athletes_override, price_cents_override, payment_promise_used_at, canceled_at";

async function loadClubSnapshot(admin: ReturnType<typeof createAdminClient>, clubId: string) {
  const { data } = await admin
    .from("clubs")
    .select(CLUB_SNAPSHOT_COLUMNS)
    .eq("id", clubId)
    .maybeSingle();
  return data;
}

/** Aceita "149,90" e "149.90" — o treinador digita com vírgula. */
function reaisParaCentavos(raw: string): number | null {
  const n = Number(raw.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function updatePlatformSettings(formData: FormData): Promise<PlatformActionResult> {
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
  const { data: before } = await admin
    .from("platform_settings")
    .select("plan_name, price_cents, trial_days, max_athletes, retention_days")
    .eq("id", true)
    .maybeSingle();

  const next = {
    plan_name: parsed.data.planName,
    price_cents: priceCents,
    trial_days: parsed.data.trialDays,
    max_athletes: parsed.data.maxAthletes,
    retention_days: parsed.data.retentionDays,
  };
  const { error } = await admin
    .from("platform_settings")
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: error.message };

  // Salvar sem mexer em nada não é mudança: não polui a trilha.
  const changes = diffFields((before ?? {}) as Record<string, unknown>, next);
  // Sem mudança não há o que registrar, então também não há o que avisar.
  let recorded = true;
  if (Object.keys(changes).length > 0) {
    recorded = await logPlatformAction({ action: "settings.update", details: { changes } });
  }

  revalidateAdmin();
  return successResult(recorded);
}

const clubActionSchema = z.object({
  clubId: z.string().uuid(),
});

/** Estende o teste em N dias a partir de hoje (ou do vencimento, se ainda houver). */
export async function extendTrial(formData: FormData): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const clubId = clubActionSchema.safeParse({ clubId: formData.get("clubId") });
  if (!clubId.success) return { error: "Clube inválido." };
  const dias = Number(formData.get("dias") ?? 15);
  if (!Number.isFinite(dias) || dias < 1 || dias > 365) return { error: "Prazo inválido." };

  const admin = createAdminClient();
  const club = await loadClubSnapshot(admin, clubId.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

  // Estende a partir do vencimento quando ele ainda está no futuro, senão
  // a partir de hoje — prorrogar um teste vencido há um mês não pode
  // devolver um prazo que já nasce no passado.
  const base =
    club.trial_ends_at && new Date(club.trial_ends_at) > new Date()
      ? club.trial_ends_at.slice(0, 10)
      : hojeISO();

  const next = { status: "trial" as const, trial_ends_at: `${somaDias(base, dias)}T23:59:59Z` };
  const { error } = await admin.from("clubs").update(next).eq("id", club.id);
  if (error) return { error: error.message };

  const recorded = await logPlatformAction({
    action: "club.extend_trial",
    club: { id: club.id, name: club.name },
    details: {
      dias,
      changes: diffFields(
        { status: club.status, trial_ends_at: club.trial_ends_at } as Record<string, unknown>,
        next,
      ),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}

const courtesySchema = z.object({
  clubId: z.string().uuid(),
  ate: z.string().min(1, "Informe até quando vale a cortesia."),
  motivo: z.string().trim().optional(),
});

/** Bonificação: libera o clube sem cobrança até uma data. */
export async function grantCourtesy(formData: FormData): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const parsed = courtesySchema.safeParse({
    clubId: formData.get("clubId"),
    ate: formData.get("ate"),
    motivo: formData.get("motivo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const admin = createAdminClient();
  const club = await loadClubSnapshot(admin, parsed.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

  const next = {
    courtesy_until: `${parsed.data.ate}T23:59:59Z`,
    courtesy_reason: parsed.data.motivo || null,
  };
  const { error } = await admin.from("clubs").update(next).eq("id", club.id);
  if (error) return { error: error.message };

  const recorded = await logPlatformAction({
    action: "club.grant_courtesy",
    club: { id: club.id, name: club.name },
    details: {
      changes: diffFields(
        { courtesy_until: club.courtesy_until, courtesy_reason: club.courtesy_reason } as Record<string, unknown>,
        next,
      ),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}

export async function revokeCourtesy(formData: FormData): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const parsed = clubActionSchema.safeParse({ clubId: formData.get("clubId") });
  if (!parsed.success) return { error: "Clube inválido." };

  const admin = createAdminClient();
  const club = await loadClubSnapshot(admin, parsed.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

  const next = { courtesy_until: null, courtesy_reason: null };
  const { error } = await admin.from("clubs").update(next).eq("id", club.id);
  if (error) return { error: error.message };

  const recorded = await logPlatformAction({
    action: "club.revoke_courtesy",
    club: { id: club.id, name: club.name },
    details: {
      changes: diffFields(
        { courtesy_until: club.courtesy_until, courtesy_reason: club.courtesy_reason } as Record<string, unknown>,
        next,
      ),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}

/** Devolve ao clube o direito à liberação automática de 48h por promessa de pagamento. */
export async function resetPaymentPromise(formData: FormData): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const parsed = clubActionSchema.safeParse({ clubId: formData.get("clubId") });
  if (!parsed.success) return { error: "Clube inválido." };

  const admin = createAdminClient();
  const club = await loadClubSnapshot(admin, parsed.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

  const { error } = await admin
    .from("clubs")
    .update({ payment_promise_used_at: null })
    .eq("id", club.id);
  if (error) return { error: error.message };

  const recorded = await logPlatformAction({
    action: "club.reset_payment_promise",
    club: { id: club.id, name: club.name },
    details: {
      changes: diffFields(
        { payment_promise_used_at: club.payment_promise_used_at } as Record<string, unknown>,
        { payment_promise_used_at: null },
      ),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}

const overrideSchema = z.object({
  clubId: z.string().uuid(),
  maxAthletes: z.string().optional(),
  priceReais: z.string().optional(),
});

/** Cota e preço próprios deste clube. Vazio volta ao padrão do plano. */
export async function setClubOverrides(formData: FormData): Promise<PlatformActionResult> {
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
  const club = await loadClubSnapshot(admin, parsed.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

  const next = { max_athletes_override: maxOverride, price_cents_override: precoOverride };
  const { error } = await admin.from("clubs").update(next).eq("id", club.id);
  if (error) return { error: error.message };

  const changes = diffFields(
    {
      max_athletes_override: club.max_athletes_override,
      price_cents_override: club.price_cents_override,
    } as Record<string, unknown>,
    next,
  );
  let recorded = true;
  if (Object.keys(changes).length > 0) {
    recorded = await logPlatformAction({
      action: "club.set_overrides",
      club: { id: club.id, name: club.name },
      details: { changes },
    });
  }

  revalidateAdmin();
  return successResult(recorded);
}

const statusSchema = z.object({
  clubId: z.string().uuid(),
  status: z.enum(["trial", "ativo", "atrasado", "bloqueado", "cancelado"]),
});

export async function setClubStatus(formData: FormData): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const parsed = statusSchema.safeParse({
    clubId: formData.get("clubId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Situação inválida." };

  const admin = createAdminClient();
  const club = await loadClubSnapshot(admin, parsed.data.clubId);
  if (!club) return { error: "Clube não encontrado." };

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

  const { error } = await admin.from("clubs").update(patch).eq("id", club.id);
  if (error) return { error: error.message };

  const recorded = await logPlatformAction({
    action: "club.set_status",
    club: { id: club.id, name: club.name },
    details: {
      changes: diffFields(
        {
          status: club.status,
          trial_ends_at: club.trial_ends_at,
          canceled_at: club.canceled_at,
        } as Record<string, unknown>,
        {
          status: patch.status,
          // Só entra no "depois" o que a ação realmente tocou.
          trial_ends_at: patch.trial_ends_at ?? club.trial_ends_at,
          canceled_at: patch.canceled_at ?? null,
        },
      ),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}
