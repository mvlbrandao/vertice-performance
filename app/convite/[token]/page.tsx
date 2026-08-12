import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { RedeemInviteForm } from "@/components/invites/RedeemInviteForm";

/** Página pública: quem abre ainda não tem conta nenhuma. */
export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invite_links")
    .select("full_name, role, expires_at, used_at, clubs(name)")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();

  const clubName = (invite?.clubs as unknown as { name: string } | null)?.name ?? "seu clube";
  const invalido =
    !invite || !!invite.used_at || new Date(invite.expires_at) < new Date();
  const motivo = !invite
    ? "Este link de convite não existe."
    : invite.used_at
      ? "Este convite já foi usado. Se a conta é sua, entre normalmente pela tela de login."
      : "Este convite expirou. Peça um novo ao seu treinador.";

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-pitch-dark">
      <div className="bg-white rounded-lg w-full max-w-[420px] p-7">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" />
          <span className="font-display text-lg tracking-wide">VÉRTICE PERFORMANCE</span>
        </div>

        {invalido ? (
          <>
            <h1 className="text-[20px] m-0 mb-2">Convite indisponível</h1>
            <p className="text-[13.5px] text-ink-soft m-0">{motivo}</p>
          </>
        ) : (
          <>
            <h1 className="text-[20px] m-0 mb-1">Olá, {invite!.full_name}!</h1>
            <p className="text-[13.5px] text-ink-soft mt-0 mb-5">
              {clubName} criou um acesso pra você. Escolha seu e-mail e senha pra entrar.
            </p>
            <RedeemInviteForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
