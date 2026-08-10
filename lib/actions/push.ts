"use server";

import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/athletes";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export async function subscribeToPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<ActionResult> {
  const profile = await getSessionProfile();
  if (!profile) return { error: "Sessão expirada." };

  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { error: "Inscrição inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profile.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent || null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };

  return { success: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<ActionResult> {
  const profile = await getSessionProfile();
  if (!profile) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", profile.userId);
  if (error) return { error: error.message };

  return { success: true };
}
