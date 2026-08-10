"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach, requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";
import { sendPushToAthlete } from "@/lib/push/send";

const meetingSchema = z.object({
  targetType: z.enum(["athlete", "team"]),
  athleteId: z.string().uuid().optional().or(z.literal("")),
  targetTeam: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Informe o título do encontro."),
  date: z.string().min(1, "Informe a data."),
  time: z.string().min(1, "Informe o horário."),
  type: z.enum(["Presencial", "Videochamada"]),
  purpose: z.enum(["Treino", "Específico"]),
  playId: z.string().uuid().optional().or(z.literal("")),
  materialVideoUrl: z.string().trim().url("Link de vídeo inválido.").optional().or(z.literal("")),
  swotItemId: z.string().uuid().optional().or(z.literal("")),
  focusTag: z.string().trim().optional().or(z.literal("")),
});

export async function createMeeting(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = meetingSchema.safeParse({
    targetType: formData.get("targetType") ?? "athlete",
    athleteId: formData.get("athleteId") ?? "",
    targetTeam: formData.get("targetTeam") ?? "",
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time"),
    type: formData.get("type"),
    purpose: formData.get("purpose") ?? "Específico",
    playId: formData.get("playId") ?? "",
    materialVideoUrl: formData.get("materialVideoUrl") ?? "",
    swotItemId: formData.get("swotItemId") ?? "",
    focusTag: formData.get("focusTag") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.targetType === "athlete" && !parsed.data.athleteId) {
    return { error: "Selecione o atleta do encontro." };
  }
  if (parsed.data.targetType === "team" && !parsed.data.targetTeam) {
    return { error: "Selecione o time do encontro." };
  }

  const supabase = await createClient();

  const base = {
    club_id: coach.clubId,
    created_by: coach.userId,
    title: parsed.data.title,
    meeting_type: parsed.data.type,
    purpose: parsed.data.purpose,
    scheduled_date: parsed.data.date,
    scheduled_time: parsed.data.time,
    play_id: parsed.data.playId || null,
    material_video_url: parsed.data.materialVideoUrl || null,
    focus_tag: parsed.data.focusTag || null,
  };

  const notifyPayload = {
    title: "🗓️ Novo encontro marcado",
    body: `${parsed.data.title} · ${parsed.data.date} às ${parsed.data.time}`,
    url: "/minha-agenda",
    tag: "new-meeting",
  };

  if (parsed.data.targetType === "athlete") {
    const { error } = await supabase.from("meetings").insert({
      ...base,
      athlete_id: parsed.data.athleteId!,
      swot_item_id: parsed.data.swotItemId || null,
    });
    if (error) return { error: error.message };
    if (parsed.data.swotItemId) revalidatePath(`/athletes/${parsed.data.athleteId}/anamnese`);
    await sendPushToAthlete(parsed.data.athleteId!, notifyPayload);
  } else {
    const { data: teamAthletes, error: athletesError } = await supabase
      .from("athletes")
      .select("id")
      .eq("club_id", coach.clubId)
      .eq("team", parsed.data.targetTeam!);
    if (athletesError) return { error: athletesError.message };
    if (!teamAthletes || teamAthletes.length === 0) {
      return { error: "Nenhum atleta encontrado nesse time." };
    }

    const batchId = crypto.randomUUID();
    const { error } = await supabase.from("meetings").insert(
      teamAthletes.map((a) => ({
        ...base,
        athlete_id: a.id,
        batch_id: batchId,
      })),
    );
    if (error) return { error: error.message };
    await Promise.all(teamAthletes.map((a) => sendPushToAthlete(a.id, notifyPayload)));
  }

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveMeetingNotes(meetingId: string, notes: string): Promise<ActionResult> {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ notes }).eq("id", meetingId);
  if (error) return { error: error.message };
  revalidatePath("/agenda");
  return { success: true };
}

export async function cancelMeeting(meetingId: string): Promise<ActionResult> {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "Cancelado" })
    .eq("id", meetingId);
  if (error) return { error: error.message };
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeMeeting(meetingId: string): Promise<ActionResult> {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "Concluído" })
    .eq("id", meetingId);
  if (error) return { error: error.message };
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function confirmMeetingAttendance(meetingId: string): Promise<ActionResult> {
  const athlete = await requireAthlete();
  if (!athlete.athleteId) return { error: "Conta não vinculada a um atleta." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ athlete_confirmed: true })
    .eq("id", meetingId)
    .eq("athlete_id", athlete.athleteId);
  if (error) return { error: error.message };
  revalidatePath("/minha-agenda");
  return { success: true };
}
