import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import {
  decideAdminGate,
  normalizeEmail,
  parseAdminAllowlist,
  type AdminGateInput,
} from "@/lib/platform/adminGate";

/**
 * Quem administra a plataforma (nós), não um clube.
 *
 * Deliberadamente **não** é um papel no banco com policy de RLS que enxerga
 * todos os clubes: uma policy assim enfraqueceria o isolamento de todo o
 * sistema pra sempre, e bastaria um engano numa consulta pra vazar dados
 * entre clubes. Em vez disso, a área roda só no servidor com service role,
 * e o portão é a lista de e-mails em PLATFORM_ADMIN_EMAILS (vários, separados
 * por vírgula). A regra de decisão mora em adminGate.ts, que é pura e testada;
 * este arquivo só junta os fatos (quem é, o e-mail está confirmado, qual o
 * nível da sessão) e aplica o veredito.
 *
 * Não exige linha em `profiles`: o dono da plataforma pode não pertencer a
 * clube nenhum, e exigir perfil o prenderia fora da própria área.
 */

export interface PlatformAdmin {
  userId: string;
  email: string;
  fullName: string;
}

export interface RequireAdminOptions {
  /**
   * Libera a sessão que ainda não passou pelo segundo fator. Só para a tela de
   * segurança e para o layout (que apenas desenha o menu): sem isso, exigir
   * MFA trancaria a pessoa fora da tela onde ela cadastra o fator.
   */
  allowAal1?: boolean;
}

export function platformAdminEmails(): string[] {
  return parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
}

/**
 * Segundo fator obrigatório? Desligado por padrão — ligar sem ter cadastrado o
 * fator é seguro (a tela de segurança continua acessível), mas só vale a pena
 * depois de cadastrar. Só "true" (ou "1") liga; qualquer outro valor deixa
 * desligado.
 */
export function platformAdminRequiresMfa(): boolean {
  const raw = (process.env.PLATFORM_ADMIN_REQUIRE_MFA ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * O e-mail pertence à lista de administradores? Os fluxos de cadastro e de
 * convite recusam esses endereços: como criam contas já confirmadas, quem
 * cadastrasse o e-mail do dono antes dele herdaria o acesso à plataforma.
 */
export function isReservedAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return platformAdminEmails().includes(normalized);
}

interface AdminAccess {
  input: Omit<AdminGateInput, "allowAal1">;
  /** Preenchido só quando a pessoa está na lista e com o e-mail confirmado. */
  admin: PlatformAdmin | null;
}

/**
 * Nível de garantia da sessão (aal1 = só senha, aal2 = senha + segundo fator).
 *
 * Passa o access token explícito: assim a biblioteca valida o token no Auth
 * (getUser(jwt)) em vez de ler `session.user` do cookie, que no servidor ela
 * considera não confiável e avisa no log a cada chamada.
 */
export async function readSessionAal(
  supabase: Awaited<ReturnType<typeof getAuthContext>>["supabase"],
): Promise<{ currentLevel: string | null; nextLevel: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { currentLevel: null, nextLevel: null };

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
    session.access_token,
  );
  if (error || !data) return { currentLevel: null, nextLevel: null };
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
}

/**
 * Resolve uma vez por requisição (cache do React) quem está na sessão e o que
 * ele pode. O usuário vem de supabase.auth.getUser(), que valida o token no
 * servidor do Auth — o cookie sozinho pode ser forjado ou estar revogado, e
 * não serve de prova de identidade.
 */
const resolveAdminAccess = cache(async (): Promise<AdminAccess> => {
  const { supabase, user } = await getAuthContext();
  const requireMfa = platformAdminRequiresMfa();

  const input: AdminAccess["input"] = {
    authenticated: !!user,
    email: user?.email ?? null,
    emailConfirmed: Boolean(user?.email_confirmed_at),
    allowlist: platformAdminEmails(),
    requireMfa,
    aal: null,
  };

  // Para quem não é da lista (a esmagadora maioria das requisições) não se
  // faz nenhuma consulta a mais.
  if (!user || decideAdminGate({ ...input, allowAal1: true }) !== "allow") {
    return { input, admin: null };
  }

  if (requireMfa) {
    input.aal = (await readSessionAal(supabase)).currentLevel;
  }

  // Nome para o menu: perfil de clube, se houver; senão o cadastrado no Auth;
  // por último o próprio e-mail.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const metaName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const email = user.email ?? "";

  return {
    input,
    admin: {
      userId: user.id,
      email,
      fullName: profile?.full_name?.trim() || metaName || email,
    },
  };
});

/**
 * Identidade do administrador da sessão, ou null. Responde "quem é", não "pode
 * entrar agora": uma sessão sem segundo fator, com MFA exigido, ainda é o
 * administrador (serve para o menu, o redirecionamento do login e o ator da
 * trilha de auditoria). Autorizar uma página ou ação é com requirePlatformAdmin.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  return (await resolveAdminAccess()).admin;
}

export async function isPlatformAdmin(): Promise<boolean> {
  return (await getPlatformAdmin()) !== null;
}

/**
 * Portão de páginas e de ações da área de administração.
 *
 *  - sem sessão                  -> /login
 *  - logado, fora da lista       -> 404 de verdade (a área não revela que existe)
 *  - lista na variável vazia     -> 404 para todos
 *  - MFA exigido e sessão aal1   -> /admin/seguranca
 *
 * Toda página e toda server action da área chama isto na primeira linha. O
 * layout também chama, mas não basta: layouts não são reexecutados a cada
 * navegação entre páginas irmãs, e uma server action é um endpoint POST que
 * dispensa a página inteira.
 */
export async function requirePlatformAdmin(
  options: RequireAdminOptions = {},
): Promise<PlatformAdmin> {
  const access = await resolveAdminAccess();
  const decision = decideAdminGate({ ...access.input, allowAal1: options.allowAal1 });

  if (decision === "login") redirect("/login");
  if (decision === "not_found") notFound();
  if (decision === "mfa_required") redirect("/admin/seguranca");

  // "allow" implica admin preenchido; se um dia deixar de implicar, falha fechada.
  if (!access.admin) notFound();
  return access.admin;
}
