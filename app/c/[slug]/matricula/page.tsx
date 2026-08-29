import { createAdminClient } from "@/lib/supabase/admin";
import { getPartnerClubOptions } from "@/lib/data/partnerClubs";
import { EnrollmentForm } from "@/components/enrollment/EnrollmentForm";

/**
 * Matrícula pública, sem login: qualquer responsável com o link do clube
 * chega aqui e envia um pedido pendente (ver lib/actions/enrollment.ts).
 * Usa o client de serviço porque quem abre esta página não tem sessão —
 * mesma justificativa de app/c/[slug]/route.ts.
 */
export default async function MatriculaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: clubRows } = await admin.rpc("club_by_slug", { p_slug: slug.toLowerCase() });
  const club = Array.isArray(clubRows) ? clubRows[0] : null;

  if (!club || club.status === "bloqueado") {
    return (
      <Moldura clubName={null}>
        <h2 className="text-[24px] mb-1 font-display">Matrícula indisponível</h2>
        <p className="text-[13.5px] text-ink-soft m-0">
          Este link não está aceitando matrículas no momento. Fale diretamente com o clube.
        </p>
      </Moldura>
    );
  }

  const partnerClubs = await getPartnerClubOptions(admin, club.id);
  const teams = partnerClubs.map((c) => ({ name: c.name, categories: c.categories }));

  return (
    <Moldura clubName={club.name}>
      <EnrollmentForm slug={club.slug} teams={teams} />
    </Moldura>
  );
}

function Moldura({ children, clubName }: { children: React.ReactNode; clubName: string | null }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 sm:p-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,214,0,.10), transparent 45%), linear-gradient(160deg, #111111 0%, #000000 100%)",
      }}
    >
      <div className="w-full max-w-[480px] bg-paper rounded-xl p-8 sm:p-10 shadow-[0_50px_100px_-30px_rgba(0,0,0,.75)] border border-white/5">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-3 h-3 rounded-full bg-amber shadow-[0_0_16px_rgba(255,214,0,.7)]" />
          <span className="font-display text-[17px] tracking-wide">
            {clubName ?? "VÉRTICE PERFORMANCE"}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
