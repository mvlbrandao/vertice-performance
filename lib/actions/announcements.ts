"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach, requireAthlete, requireStaff } from "@/lib/auth/guards";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import { sendPushToAthlete } from "@/lib/push/send";

const announcementSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do aviso."),
  body: z.string().trim().min(1, "Informe o texto do aviso."),
  targetTeam: z.string().trim().optional().or(z.literal("")),
  targetCategory: z.string().trim().optional().or(z.literal("")),
});

export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    targetTeam: formData.get("targetTeam") ?? "",
    targetCategory: formData.get("targetCategory") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const targetTeam = parsed.data.targetTeam || null;
  const targetCategory = parsed.data.targetCategory || null;

  const { error } = await supabase.from("announcements").insert({
    club_id: coach.clubId,
    created_by: coach.userId,
    title: parsed.data.title,
    body: parsed.data.body,
    target_team: targetTeam,
    target_category: targetCategory,
  });
  if (error) return { error: error.message };

  let athletesQuery = supabase
    .from("athletes")
    .select("id")
    .eq("club_id", coach.clubId)
    .eq("is_active", true);
  if (targetTeam) athletesQuery = athletesQuery.eq("team", targetTeam);
  if (targetCategory) athletesQuery = athletesQuery.eq("category", targetCategory);
  const { data: targetAthletes } = await athletesQuery;

  await Promise.all(
    (targetAthletes ?? []).map((a) =>
      sendPushToAthlete(a.id, {
        title: "📣 Novo aviso",
        body: parsed.data.title,
        url: "/perfil",
        tag: "new-announcement",
      }),
    ),
  );

  revalidatePath("/comunicados");
  revalidatePath("/perfil");
  revalidatePath("/meus-atletas");
  return { success: true };
}

export async function deleteAnnouncement(announcementId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .eq("club_id", coach.clubId);
  if (error) return { error: error.message };
  revalidatePath("/comunicados");
  return { success: true };
}

export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile || (profile.role !== "athlete" && profile.role !== "staff")) return;
  if (profile.role === "athlete") await requireAthlete();
  if (profile.role === "staff") await requireStaff();

  const supabase = await createClient();
  await supabase
    .from("announcement_reads")
    .upsert(
      { announcement_id: announcementId, profile_id: profile.userId },
      { onConflict: "announcement_id,profile_id" },
    );
  revalidatePath("/perfil");
  revalidatePath("/meus-atletas");
}
