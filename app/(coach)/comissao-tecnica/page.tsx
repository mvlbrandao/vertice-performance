import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { computePlayerScore } from "@/lib/scoring";
import { ComissaoTecnicaClient, type ScoutAthlete } from "@/components/scouting/ComissaoTecnicaClient";

export default async function ComissaoTecnicaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, full_name, team, category")
    .eq("club_id", profile!.clubId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const scouted: ScoutAthlete[] = await Promise.all(
    (athletes ?? []).map(async (a) => {
      const score = await computePlayerScore(supabase, a.id);
      return {
        id: a.id,
        full_name: a.full_name,
        team: a.team,
        category: a.category,
        attack: score.attack,
        defense: score.defense,
        overall: score.overall,
        warnings: score.warnings,
      };
    }),
  );

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">
          Comissão Técnica
        </div>
        <h1 className="text-[28px] m-0">Dispersão Ofensivo × Defensivo</h1>
        <p className="text-sm text-ink-faint mt-1 max-w-[64ch]">
          Cada ponto é um atleta ativo. Quem fica acima da linha e à direita é completo nos dois
          lados do jogo; os cantos opostos mostram especialistas ou quem ainda está desenvolvendo
          fundamentos. Use os filtros pra comparar dentro do mesmo sub.
        </p>
      </div>

      {scouted.length === 0 ? (
        <Card>
          <EmptyState icon="🔬" message="Nenhum atleta ativo cadastrado ainda." />
        </Card>
      ) : (
        <Card>
          <ComissaoTecnicaClient athletes={scouted} />
        </Card>
      )}
    </div>
  );
}
