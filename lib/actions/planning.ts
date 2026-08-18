"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const COLORS = ["dark", "sky", "amber", "clay", "green"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da coluna.").max(40, "Nome muito longo."),
});

export async function createPlanningColumn(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("planning_columns")
    .select("position")
    .eq("club_id", coach.clubId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("planning_columns").insert({
    club_id: coach.clubId,
    name: parsed.data.name,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath("/comissao-tecnica/planejamento");
  return { success: true };
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome da coluna.").max(40, "Nome muito longo."),
  color: z.enum(COLORS),
});

export async function renamePlanningColumn(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = renameSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("planning_columns")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", parsed.data.id)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/comissao-tecnica/planejamento");
  return { success: true };
}

const reorderSchema = z.object({
  id: z.string().uuid(),
  direcao: z.enum(["subir", "descer"]),
});

/** Troca de posição com o vizinho — sem drag de coluna na v1, só de card. */
export async function reorderPlanningColumn(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = reorderSchema.safeParse({
    id: formData.get("id"),
    direcao: formData.get("direcao"),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: colunas } = await supabase
    .from("planning_columns")
    .select("id, position")
    .eq("club_id", coach.clubId)
    .order("position", { ascending: true });
  if (!colunas) return { error: "Não foi possível carregar as colunas." };

  const idx = colunas.findIndex((c) => c.id === parsed.data.id);
  if (idx === -1) return { error: "Coluna não encontrada." };
  const vizinhoIdx = parsed.data.direcao === "subir" ? idx - 1 : idx + 1;
  if (vizinhoIdx < 0 || vizinhoIdx >= colunas.length) return { success: true };

  const atual = colunas[idx];
  const vizinho = colunas[vizinhoIdx];

  const [r1, r2] = await Promise.all([
    supabase.from("planning_columns").update({ position: vizinho.position }).eq("id", atual.id),
    supabase.from("planning_columns").update({ position: atual.position }).eq("id", vizinho.id),
  ]);
  if (r1.error) return { error: r1.error.message };
  if (r2.error) return { error: r2.error.message };

  revalidatePath("/comissao-tecnica/planejamento");
  return { success: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deletePlanningColumn(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Coluna inválida." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("athlete_planning_stage")
    .select("id", { count: "exact", head: true })
    .eq("column_id", parsed.data.id);
  if (count && count > 0) {
    return { error: "Mova os atletas desta coluna antes de removê-la." };
  }

  const { error } = await supabase
    .from("planning_columns")
    .delete()
    .eq("id", parsed.data.id)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };

  revalidatePath("/comissao-tecnica/planejamento");
  return { success: true };
}

const moveSchema = z.object({
  athleteId: z.string().uuid(),
  columnId: z.string().uuid(),
  note: z.string().trim().max(280, "Nota muito longa.").optional(),
});

export async function moveAthleteCard(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = moveSchema.safeParse({
    athleteId: formData.get("athleteId"),
    columnId: formData.get("columnId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("athlete_planning_stage")
    .select("column_id")
    .eq("athlete_id", parsed.data.athleteId)
    .maybeSingle();

  const mudouColuna = !existing || existing.column_id !== parsed.data.columnId;

  const { error } = await supabase.from("athlete_planning_stage").upsert(
    {
      club_id: coach.clubId,
      athlete_id: parsed.data.athleteId,
      column_id: parsed.data.columnId,
      note: parsed.data.note ?? null,
      ...(mudouColuna ? { moved_at: new Date().toISOString() } : {}),
    },
    { onConflict: "athlete_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/comissao-tecnica/planejamento");
  return { success: true };
}
