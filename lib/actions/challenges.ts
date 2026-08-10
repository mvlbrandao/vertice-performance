"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach, requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CHALLENGE_TIERS } from "@/lib/data/challengeTiers";
import type { ActionResult } from "@/lib/actions/athletes";

function paths() {
  revalidatePath("/desafios");
  revalidatePath("/desafios-gestao");
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  description: z.string().trim().min(1, "Informe a descrição."),
  tier: z.enum(CHALLENGE_TIERS),
  points: z.string().min(1),
  athleteId: z.string().uuid().optional().or(z.literal("")),
  targetPosition: z.string().trim().optional(),
});

export async function createChallenge(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    tier: formData.get("tier"),
    points: formData.get("points"),
    athleteId: formData.get("athleteId") ?? "",
    targetPosition: formData.get("targetPosition") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const points = Math.round(Number(parsed.data.points));
  if (!Number.isFinite(points) || points <= 0) {
    return { error: "Pontuação inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("challenges").insert({
    club_id: coach.clubId,
    athlete_id: parsed.data.athleteId || null,
    title: parsed.data.title,
    description: parsed.data.description,
    tier: parsed.data.tier,
    points,
    target_position: parsed.data.targetPosition || null,
    created_by: coach.userId,
  });
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

export async function archiveChallenge(challengeId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("challenges")
    .update({ status: "Arquivado" })
    .eq("id", challengeId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

const submitSchema = z.object({
  challengeId: z.string().uuid(),
  instagramUrl: z.string().trim().url("Cole um link válido."),
  notes: z.string().trim().optional(),
});

export async function submitChallenge(formData: FormData): Promise<ActionResult> {
  const profile = await requireAthlete();
  if (!profile.athleteId) return { error: "Perfil de atleta não encontrado." };

  const parsed = submitSchema.safeParse({
    challengeId: formData.get("challengeId"),
    instagramUrl: formData.get("instagramUrl"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("challenge_submissions")
    .select("id")
    .eq("challenge_id", parsed.data.challengeId)
    .eq("athlete_id", profile.athleteId)
    .in("status", ["Pendente", "Aprovado"])
    .maybeSingle();
  if (existing) return { error: "Você já enviou (ou já teve aprovada) uma resposta pra esse desafio." };

  const { error } = await supabase.from("challenge_submissions").insert({
    club_id: profile.clubId,
    challenge_id: parsed.data.challengeId,
    athlete_id: profile.athleteId,
    instagram_url: parsed.data.instagramUrl,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  paths();
  return { success: true };
}

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(["Aprovado", "Rejeitado"]),
  reviewNotes: z.string().trim().optional(),
});

export async function reviewSubmission(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = reviewSchema.safeParse({
    submissionId: formData.get("submissionId"),
    decision: formData.get("decision"),
    reviewNotes: formData.get("reviewNotes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("challenge_submissions")
    .select("id, status, challenges(points)")
    .eq("id", parsed.data.submissionId)
    .eq("club_id", coach.clubId)
    .single();
  if (!submission) return { error: "Envio não encontrado." };
  if (submission.status !== "Pendente") return { error: "Esse envio já foi avaliado." };

  const points =
    parsed.data.decision === "Aprovado"
      ? ((submission.challenges as unknown as { points: number } | null)?.points ?? 0)
      : null;

  const { error } = await supabase
    .from("challenge_submissions")
    .update({
      status: parsed.data.decision,
      points_awarded: points,
      reviewed_by: coach.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: parsed.data.reviewNotes || null,
    })
    .eq("id", parsed.data.submissionId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  paths();
  return { success: true };
}
