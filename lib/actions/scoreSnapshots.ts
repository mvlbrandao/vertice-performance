"use server";

import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Marca um alerta de mudança de score como visto, depois que o cliente já o renderizou. */
export async function acknowledgeScoreSnapshot(snapshotId: string): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("athlete_score_snapshots")
    .update({ acknowledged: true })
    .eq("id", snapshotId)
    .eq("acknowledged", false);
}
