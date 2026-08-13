import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClubStatus } from "@/lib/types/database";

/**
 * A licença de um clube: quanto custa, até quando vale e quantos atletas
 * cabem. O padrão vem de platform_settings; o clube só carrega o que foge
 * do padrão. Assim mudar o plano vale pra todos, e a bonificação de um
 * cliente específico não vira exceção espalhada pelo código.
 */
export interface ClubLicense {
  clubId: string;
  clubName: string;
  status: ClubStatus;
  planName: string;
  priceCents: number;
  maxAthletes: number;
  trialEndsAt: string | null;
  courtesyUntil: string | null;
  courtesyReason: string | null;
  /** Dias restantes de teste ou cortesia. Negativo já venceu. */
  daysLeft: number | null;
  /** Se pode usar o sistema agora. */
  allowed: boolean;
  /** Por que está bloqueado, quando estiver. */
  blockedReason: "trial_expirado" | "assinatura" | "cancelado" | null;
}

export interface PlatformSettings {
  planName: string;
  priceCents: number;
  trialDays: number;
  maxAthletes: number;
  retentionDays: number;
}

/**
 * cache() do React: o guard roda em toda página e a licença são duas
 * consultas. Sem isso, cada tela pagaria o custo mais de uma vez por
 * requisição.
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select("plan_name, price_cents, trial_days, max_athletes, retention_days")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler as configurações da plataforma: ${error.message}`);
  if (!data) throw new Error("Configuração da plataforma ausente (platform_settings vazia).");

  return {
    planName: data.plan_name,
    priceCents: data.price_cents,
    trialDays: data.trial_days,
    maxAthletes: data.max_athletes,
    retentionDays: data.retention_days,
  };
});

function diffDays(target: string): number {
  const ms = new Date(target).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export const getClubLicense = cache(async (clubId: string): Promise<ClubLicense> => {
  const admin = createAdminClient();
  const [settings, club] = await Promise.all([
    getPlatformSettings(),
    admin
      .from("clubs")
      .select(
        "id, name, status, trial_ends_at, courtesy_until, courtesy_reason, max_athletes_override, price_cents_override",
      )
      .eq("id", clubId)
      .maybeSingle(),
  ]);

  if (club.error) throw new Error(`Falha ao ler o clube: ${club.error.message}`);
  if (!club.data) throw new Error("Clube não encontrado.");
  const c = club.data;

  const courtesyActive = !!c.courtesy_until && new Date(c.courtesy_until) > new Date();

  // Cortesia vence antes de qualquer outra regra: bonificar um cliente
  // significa que ele entra mesmo com o teste vencido ou a cobrança falhando.
  let allowed: boolean;
  let blockedReason: ClubLicense["blockedReason"] = null;

  if (courtesyActive) {
    allowed = true;
  } else if (c.status === "cancelado") {
    allowed = false;
    blockedReason = "cancelado";
  } else if (c.status === "bloqueado") {
    allowed = false;
    blockedReason = "assinatura";
  } else if (c.status === "trial") {
    const venceu = !c.trial_ends_at || new Date(c.trial_ends_at) <= new Date();
    allowed = !venceu;
    blockedReason = venceu ? "trial_expirado" : null;
  } else {
    // ativo e atrasado seguem entrando: atraso mostra aviso, não porta
    // fechada — cortar acesso no primeiro boleto falho perde cliente que
    // só trocou de cartão.
    allowed = true;
  }

  const referencia = courtesyActive ? c.courtesy_until! : c.trial_ends_at;

  return {
    clubId: c.id,
    clubName: c.name,
    status: c.status,
    planName: settings.planName,
    priceCents: c.price_cents_override ?? settings.priceCents,
    maxAthletes: c.max_athletes_override ?? settings.maxAthletes,
    trialEndsAt: c.trial_ends_at,
    courtesyUntil: c.courtesy_until,
    courtesyReason: c.courtesy_reason,
    daysLeft: referencia ? diffDays(referencia) : null,
    allowed,
    blockedReason,
  };
});

/**
 * Quantos atletas ativos o clube já tem e se ainda cabe mais. Conta só os
 * ativos: desativar um atleta precisa liberar a vaga, senão o clube pagaria
 * por quem já saiu.
 */
export async function getAthleteUsage(clubId: string): Promise<{
  used: number;
  max: number;
  hasRoom: boolean;
}> {
  const admin = createAdminClient();
  const license = await getClubLicense(clubId);
  const { count, error } = await admin
    .from("athletes")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("is_active", true);

  if (error) throw new Error(`Falha ao contar atletas: ${error.message}`);
  const used = count ?? 0;
  return { used, max: license.maxAthletes, hasRoom: used < license.maxAthletes };
}
