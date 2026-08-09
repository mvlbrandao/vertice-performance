import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { PartnerClubOption } from "@/lib/types/partnerClubs";

export async function getPartnerClubOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
): Promise<PartnerClubOption[]> {
  const [{ data: partnerClubs }, { data: categories }] = await Promise.all([
    supabase
      .from("partner_clubs")
      .select("id, name, color_1, color_2, color_3")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
    supabase
      .from("partner_club_categories")
      .select("partner_club_id, name")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
  ]);

  const categoriesByClub = new Map<string, string[]>();
  for (const c of categories ?? []) {
    const list = categoriesByClub.get(c.partner_club_id) ?? [];
    list.push(c.name);
    categoriesByClub.set(c.partner_club_id, list);
  }

  return (partnerClubs ?? []).map((pc) => ({
    id: pc.id,
    name: pc.name,
    categories: categoriesByClub.get(pc.id) ?? [],
    color1: pc.color_1,
    color2: pc.color_2,
    color3: pc.color_3,
  }));
}
