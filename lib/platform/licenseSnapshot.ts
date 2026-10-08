import type { ClubStatus } from "@/lib/types/database";
import type { LicenseSnapshot } from "@/lib/platform/contractRules";

/**
 * Retrato da licença de um clube a partir da linha dele e do plano padrão,
 * sem ir ao banco. Espelha as regras de acesso de getClubLicense
 * (lib/platform/license.ts); existe separado porque a lista de contratos
 * precisa da licença de MUITOS clubes de uma vez, e getClubLicense faz duas
 * consultas por clube.
 *
 * Se as regras de acesso mudarem lá, mudam aqui também (os testes deste
 * arquivo fixam as regras atuais: cortesia vence tudo, teste vencido bloqueia,
 * atrasado ainda entra).
 */
export interface LicenseClubInput {
  status: ClubStatus;
  trial_ends_at: string | null;
  courtesy_until: string | null;
  max_athletes_override: number | null;
  price_cents_override: number | null;
  is_demo: boolean;
}

export interface LicenseDefaults {
  priceCents: number;
  maxAthletes: number;
}

export function buildLicenseSnapshot(
  club: LicenseClubInput,
  defaults: LicenseDefaults,
  now: Date = new Date(),
): LicenseSnapshot {
  const courtesyActive = !!club.courtesy_until && new Date(club.courtesy_until) > now;

  let allowed: boolean;
  if (courtesyActive) {
    // Cortesia vence antes de qualquer outra regra: bonificar é liberar o
    // clube mesmo com teste vencido ou cobrança falhando.
    allowed = true;
  } else if (club.status === "cancelado" || club.status === "bloqueado") {
    allowed = false;
  } else if (club.status === "trial") {
    allowed = !!club.trial_ends_at && new Date(club.trial_ends_at) > now;
  } else {
    // ativo e atrasado seguem entrando: atraso mostra aviso, não porta fechada.
    allowed = true;
  }

  return {
    status: club.status,
    allowed,
    courtesyActive,
    courtesyUntil: courtesyActive ? club.courtesy_until!.slice(0, 10) : null,
    priceCents: club.price_cents_override ?? defaults.priceCents,
    maxAthletes: club.max_athletes_override ?? defaults.maxAthletes,
    defaultMaxAthletes: defaults.maxAthletes,
    isDemo: club.is_demo,
  };
}
