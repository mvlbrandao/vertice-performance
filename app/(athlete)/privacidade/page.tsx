import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { DataRequestButtons } from "@/components/privacy/DataRequestButtons";

const DATA_ITEMS = [
  ["Dados pessoais", "nome, nascimento, categoria, posição"],
  ["Dados de saúde", "dores relatadas, nível de cansaço, IMC"],
  ["Mídia", "fotos e vídeos de jogos e treinos"],
  ["Avaliações", "relatórios técnicos, mentais e de nutrição"],
];

export default async function AthletePrivacidadePage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: athlete } = profile?.athleteId
    ? await supabase
        .from("athletes")
        .select("guardian_name, joined_at")
        .eq("id", profile.athleteId)
        .single()
    : { data: null };

  return (
    <div>
      <h2 className="text-[28px] mb-1">Privacidade dos meus dados</h2>
      <div className="flex gap-2 items-start bg-chalk border border-line rounded-md px-3.5 py-3 text-[12.5px] my-4">
        <span>ℹ️</span>
        <span>
          Aqui você vê apenas os seus direitos sobre os seus dados. O treinador tem, além
          disso, controles administrativos do clube inteiro.
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 mb-3">O que guardamos sobre você</h3>
          {DATA_ITEMS.map(([k, v]) => (
            <div key={k} className="py-2.5 border-b border-line text-[13.5px] last:border-b-0">
              <b>{k}</b>
              <br />
              <span className="text-ink-faint text-[12.5px]">{v}</span>
            </div>
          ))}
          <div className="flex gap-2 items-start bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px] mt-3.5">
            <span>🔒</span>
            <span>
              Como você está registrado como categoria de base, esses dados são
              criptografados e o acesso é restrito ao seu treinador e ao seu responsável
              legal{athlete?.guardian_name ? ` (${athlete.guardian_name})` : ""}.
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="mt-0 mb-3">Seus direitos (LGPD)</h3>
          <p className="text-[12.5px] text-ink-soft mb-3.5 leading-relaxed">
            {athlete?.guardian_name
              ? `Consentimento registrado por ${athlete.guardian_name}${athlete.joined_at ? ` em ${athlete.joined_at}` : ""}.`
              : "Consentimento registrado por seu responsável legal."}{" "}
            Você pode solicitar uma cópia ou a exclusão dos seus dados a qualquer momento.
          </p>
          <DataRequestButtons />
        </Card>
      </div>
    </div>
  );
}
