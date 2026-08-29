import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Áreas liberadas pro staff logado — controla que abas/ações aparecem. */
export async function getStaffAreas(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("staff_areas")
    .eq("id", userId)
    .single();
  return data?.staff_areas ?? [];
}
