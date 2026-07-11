"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const meetingSchema = z.object({
  athleteId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o título do encontro."),
  date: z.string().min(1, "Informe a data."),
  time: z.string().min(1, "Informe o horário."),
  type: z.enum(["Presencial", "Videochamada"]),
});

export async function createMeeting(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = meetingSchema.safeParse({
    athleteId: formData.get("athleteId"),
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    athlete_id: parsed.data.athleteId,
    club_id: coach.clubId,
    created_by: coach.userId,
    title: parsed.data.title,
    meeting_type: parsed.data.type,
    scheduled_date: parsed.data.date,
    scheduled_time: parsed.data.time,
  });

  if (error) return { error: error.message };
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
