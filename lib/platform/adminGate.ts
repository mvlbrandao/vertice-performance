/**
 * Decisão de acesso à área de administração da plataforma. Função PURA, sem
 * "server-only" nem rede: quem consulta o Supabase é lib/platform/admin.ts,
 * e aqui só se decide. Separar assim deixa a regra de segurança testável sem
 * sessão real — é a parte que não pode regredir sem alguém perceber.
 */

export type AdminGateDecision = "allow" | "login" | "not_found" | "mfa_required";

export interface AdminGateInput {
  authenticated: boolean;
  email: string | null | undefined;
  /** E-mail confirmado no Auth (email_confirmed_at preenchido). */
  emailConfirmed: boolean;
  allowlist: readonly string[];
  requireMfa: boolean;
  /** Nível de garantia da sessão ("aal1" | "aal2"); null/undefined = desconhecido. */
  aal: string | null | undefined;
  /**
   * Páginas que a pessoa precisa alcançar mesmo sem ter passado pelo segundo
   * fator (cadastrar o fator, digitar o código). Sem esta saída, exigir MFA
   * trancaria o administrador do lado de fora da tela que o libera.
   */
  allowAal1?: boolean;
}

/** Compara e-mails sem diferenciar maiúsculas nem espaços nas pontas. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Lê PLATFORM_ADMIN_EMAILS. Aceita vírgula, ponto e vírgula, espaço e quebra
 * de linha como separador, e tira aspas das pontas: a variável é colada à mão
 * no painel da Vercel, e um separador "errado" não pode virar uma lista
 * silenciosamente vazia (o que bloquearia o dono) nem um endereço quebrado.
 */
export function parseAdminAllowlist(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[\s,;]+/)) {
    const email = normalizeEmail(part.replace(/^["']+|["']+$/g, ""));
    if (email) seen.add(email);
  }
  return [...seen];
}

export function decideAdminGate(input: AdminGateInput): AdminGateDecision {
  // Sem sessão não há o que esconder: manda entrar.
  if (!input.authenticated) return "login";

  const email = normalizeEmail(input.email);
  const allowed = input.allowlist.map(normalizeEmail).filter(Boolean);

  // Lista vazia bloqueia todo mundo. O contrário — liberar geral quando a
  // variável falta — transformaria um esquecimento de configuração numa
  // porta aberta a qualquer usuário logado.
  if (allowed.length === 0) return "not_found";
  if (!email || !allowed.includes(email)) return "not_found";

  // E-mail não confirmado não prova que a pessoa é dona do endereço. Sem esta
  // checagem, quem cadastrasse a conta com o e-mail do dono antes dele (se o
  // projeto aceitasse cadastro sem confirmação) herdaria o acesso.
  if (!input.emailConfirmed) return "not_found";

  if (input.requireMfa && !input.allowAal1 && input.aal !== "aal2") return "mfa_required";

  return "allow";
}

/**
 * Esconde o miolo do e-mail para telas que listam quem tem acesso: o
 * endereço do administrador é, na prática, metade da credencial.
 * "maria.silva@gmail.com" vira "m***a@gmail.com".
 */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return "***";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
