import "server-only";
import type { createClient } from "@/lib/supabase/server";

export interface VisibleAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

/**
 * Avisos visíveis pro perfil logado, já com estado de leitura. Filtro de
 * público (time/categoria) é enforced pela RLS de `announcements` — aqui só
 * ordena, limita e marca lido/não lido.
 */
export async function getVisibleAnnouncements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  profileId: string,
  limit = 8,
): Promise<VisibleAnnouncement[]> {
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!announcements || announcements.length === 0) return [];

  const { data: reads } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("profile_id", profileId)
    .in(
      "announcement_id",
      announcements.map((a) => a.id),
    );
  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));

  return announcements.map((a) => ({ ...a, read: readIds.has(a.id) }));
}
