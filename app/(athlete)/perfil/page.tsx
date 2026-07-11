import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { initials } from "@/lib/utils/initials";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-line text-[13.5px] last:border-b-0">
      <span className="text-ink-faint">{k}</span>
      <b>{v}</b>
    </div>
  );
}

export default async function AthletePerfilPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile?.athleteId) {
    return (
      <Card>
        <p className="text-sm text-ink-soft m-0">
          Sua conta ainda não está vinculada a um perfil de atleta. Fale com seu treinador.
        </p>
      </Card>
    );
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("id", profile.athleteId)
    .single();

  if (!athlete) return null;

  const signedPhotoUrl = await resolveSignedUrl("athlete-photos", athlete.photo_url);
  const hasPain = athlete.current_pain && athlete.current_pain !== "Nenhuma";

  return (
    <div>
      <Card shadow className="flex gap-4.5 items-center mb-4.5 flex-wrap">
        {signedPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedPhotoUrl}
            alt={athlete.full_name}
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center font-display text-[26px] shrink-0"
            style={{ background: athlete.photo_color ?? "#111", color: "#FFD600" }}
          >
            {initials(athlete.full_name)}
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <h2 className="m-0 mb-1 font-sans text-xl font-extrabold">{athlete.full_name}</h2>
          <div className="flex gap-1.5 flex-wrap">
            {athlete.category && <Badge tone="green">{athlete.category}</Badge>}
            {athlete.position && <Badge tone="amber">{athlete.position}</Badge>}
            {athlete.team && <Badge tone="sky">{athlete.team}</Badge>}
          </div>
        </div>
        <div className="flex gap-6.5 text-center">
          <div>
            <b className="font-mono text-lg block">
              {athlete.height_cm ? `${athlete.height_cm}cm` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Altura</span>
          </div>
          <div>
            <b className="font-mono text-lg block">
              {athlete.weight_kg ? `${athlete.weight_kg}kg` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Peso</span>
          </div>
          <div>
            <b className="font-mono text-lg block">{athlete.bmi ?? "—"}</b>
            <span className="text-[11px] text-ink-faint">IMC</span>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 mb-3">Meus dados</h3>
          <Row k="Nascimento" v={athlete.birth_date ?? "—"} />
          <Row k="Responsável" v={athlete.guardian_name ?? "—"} />
          <Row k="Categoria" v={athlete.category ?? "—"} />
          <Row k="Posição" v={athlete.position ?? "—"} />
          <Row k="Time" v={athlete.team ?? "—"} />
          <Row k="Na plataforma desde" v={athlete.joined_at ?? "—"} />
        </Card>
        <Card>
          <h3 className="mt-0 mb-3">Saúde & condição física</h3>
          <div
            className={`flex gap-2 items-start rounded-md px-3.5 py-3 text-[12.5px] ${
              hasPain
                ? "bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000]"
                : "bg-chalk border border-line text-ink-soft"
            }`}
          >
            <span>{hasPain ? "⚠️" : "💪"}</span>
            <span>
              {hasPain
                ? `Relato ativo: ${athlete.current_pain}`
                : "Nenhuma dor relatada nos últimos check-ins."}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
