import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboardingStepStatus, countDoneSteps } from "@/lib/onboarding/checklist";
import type { ClubStatus } from "@/lib/types/database";

export type LeadBucket = "convertido" | "perdido" | "quente" | "engajado" | "novo";

export const LEAD_BUCKET_LABEL: Record<LeadBucket, string> = {
  convertido: "Convertido",
  perdido: "Perdido",
  quente: "Quente",
  engajado: "Engajado",
  novo: "Novo",
};

export interface ClubLead {
  clubId: string;
  clubName: string;
  slug: string;
  status: ClubStatus;
  diasEmTrial: number;
  diasRestantes: number | null;
  atletasAtivos: number;
  checklistDone: number;
  checklistTotal: number;
  ultimoAcesso: string | null;
  bucket: LeadBucket;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/**
 * Ordem importa: o primeiro balde que bater vale. Convertido/perdido são
 * estados terminais e vêm antes de qualquer sinal de engajamento — não
 * faz sentido chamar de "quente" um clube que já cancelou.
 */
function classifyBucket(input: {
  status: ClubStatus;
  trialVencido: boolean;
  diasRestantes: number | null;
  engajado: boolean;
}): LeadBucket {
  if (input.status === "ativo" || input.status === "atrasado") return "convertido";
  if (input.status === "cancelado") return "perdido";
  if (input.status === "trial" && input.trialVencido) return "perdido";
  if (input.diasRestantes !== null && input.diasRestantes <= 3) return "quente";
  if (input.engajado) return "engajado";
  return "novo";
}

/**
 * Funil de leads: um lead aqui é qualquer clube não-demo. Cruza dados que
 * já existem (status, checklist de "Primeiros passos", contagem de
 * atletas) com o último acesso, que só o Supabase Auth guarda
 * (auth.users.last_sign_in_at) — nada disso tinha rastreamento próprio no
 * app até agora.
 */
export async function buildLeadFunnel(
  clubs: {
    id: string;
    name: string;
    slug: string;
    status: ClubStatus;
    trial_ends_at: string | null;
    created_at: string;
    owner_profile_id: string | null;
  }[],
  athleteCountByClub: Map<string, number>,
): Promise<ClubLead[]> {
  const admin = createAdminClient();

  // Clubes já convertidos/perdidos não precisam do checklist pra classificar
  // — mas mostramos mesmo assim, então calculamos pra todos os não-demo.
  const [checklists, { data: usersPage }] = await Promise.all([
    Promise.all(clubs.map((c) => getOnboardingStepStatus(admin, c.id))),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const lastSignInByUserId = new Map<string, string | null>();
  for (const u of usersPage?.users ?? []) {
    lastSignInByUserId.set(u.id, u.last_sign_in_at ?? null);
  }

  return clubs.map((club, i) => {
    const checklist = checklists[i];
    const { done, total } = countDoneSteps(checklist);
    const diasRestantes = club.status === "trial" ? diasAte(club.trial_ends_at) : null;
    const trialVencido = diasRestantes !== null && diasRestantes <= 0;
    const atletasAtivos = athleteCountByClub.get(club.id) ?? 0;

    return {
      clubId: club.id,
      clubName: club.name,
      slug: club.slug,
      status: club.status,
      diasEmTrial: diasDesde(club.created_at),
      diasRestantes,
      atletasAtivos,
      checklistDone: done,
      checklistTotal: total,
      ultimoAcesso: club.owner_profile_id ? lastSignInByUserId.get(club.owner_profile_id) ?? null : null,
      bucket: classifyBucket({
        status: club.status,
        trialVencido,
        diasRestantes,
        engajado: atletasAtivos > 0 || done > 0,
      }),
    };
  });
}
