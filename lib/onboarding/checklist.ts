import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface OnboardingStepStatus {
  atleta: boolean;
  jogo: boolean;
  cobranca: boolean;
  jogada: boolean;
}

/**
 * Os 4 passos de "Primeiros passos" (components/onboarding/PrimeirosPassos.tsx).
 * Cada passo é medido pelo estado real do clube, nunca por uma flag
 * guardada à parte — assim o checklist não mente se algo for apagado, e
 * quem já usa o sistema nunca vê a lista de novo.
 */
export async function getOnboardingStepStatus(
  supabase: SupabaseClient<Database>,
  clubId: string,
): Promise<OnboardingStepStatus> {
  const [{ count: athletesCount }, { count: jogosCount }, { count: cobrancasCount }, { count: jogadasCount }] =
    await Promise.all([
      supabase
        .from("athletes")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("is_active", true),
      supabase.from("games").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      supabase
        .from("athlete_charges")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId),
      supabase.from("plays").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    ]);

  return {
    atleta: (athletesCount ?? 0) > 0,
    jogo: (jogosCount ?? 0) > 0,
    cobranca: (cobrancasCount ?? 0) > 0,
    jogada: (jogadasCount ?? 0) > 0,
  };
}

/** Só a contagem — o que o painel da plataforma precisa pro funil de leads. */
export function countDoneSteps(status: OnboardingStepStatus): { done: number; total: number } {
  const feitos = Object.values(status);
  return { done: feitos.filter(Boolean).length, total: feitos.length };
}
