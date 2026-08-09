import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { initials } from "@/lib/utils/initials";

export default async function StaffAthletesPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // RLS ("staff reads granted athletes") já restringe às linhas liberadas;
  // o join por athlete_staff_access aqui só define a ordem/lista visível.
  const { data: grants } = await supabase
    .from("athlete_staff_access")
    .select(
      "athletes(id, full_name, team, category, position, photo_url, photo_color, current_pain)",
    )
    .eq("staff_profile_id", profile!.userId);

  type GrantedAthlete = {
    id: string;
    full_name: string;
    team: string | null;
    category: string | null;
    position: string[] | null;
    photo_url: string | null;
    photo_color: string | null;
    current_pain: string | null;
  };

  const athletes = (grants ?? [])
    .map((g) => g.athletes as unknown as GrantedAthlete | null)
    .filter((a): a is GrantedAthlete => a !== null);

  const athletesWithPhotos = await Promise.all(
    athletes.map(async (a) => ({
      ...a,
      signedPhotoUrl: await resolveSignedUrl("athlete-photos", a.photo_url),
    })),
  );

  return (
    <div>
      <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">Meus atletas</div>
      <h1 className="text-[28px] mb-1">Olá, {profile!.fullName.split(" ")[0]} 👋</h1>
      <p className="text-xs text-ink-faint mb-6 max-w-xl">
        Você vê aqui só os atletas liberados pelo treinador do clube. Acompanhamento completo
        (prescrever treino, agendar encontro) chega numa próxima etapa — por enquanto essa tela é
        de consulta.
      </p>

      {athletesWithPhotos.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔒"
            message="Nenhum atleta liberado pra você ainda. Peça ao treinador do clube pra conceder acesso."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletesWithPhotos.map((a) => (
            <Card key={a.id} shadow>
              <div className="flex items-center gap-3 mb-3">
                {a.signedPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedPhotoUrl}
                    alt={a.full_name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center font-display text-lg shrink-0"
                    style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                  >
                    {initials(a.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <b className="block text-base truncate">{a.full_name}</b>
                  <span className="text-xs text-ink-faint truncate block">{a.team ?? "—"}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                {a.category && <Badge tone="green">{a.category}</Badge>}
                {a.position?.map((p) => (
                  <Badge key={p} tone="amber">
                    {p}
                  </Badge>
                ))}
              </div>
              <Badge tone={!a.current_pain || a.current_pain === "Nenhuma" ? "green" : "clay"}>
                {!a.current_pain || a.current_pain === "Nenhuma" ? "Apto" : `Atenção: ${a.current_pain}`}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
