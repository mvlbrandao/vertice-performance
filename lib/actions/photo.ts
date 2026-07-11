"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

export async function setAthletePhotoPath(
  athleteId: string,
  storagePath: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({ photo_url: storagePath })
    .eq("id", athleteId);
  if (error) return { error: error.message };
  revalidatePath(`/athletes/${athleteId}`);
  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  return { success: true };
}
