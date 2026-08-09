/**
 * Traduz mensagens de erro do Supabase Auth (GoTrue) pra algo que faça
 * sentido pra quem está convidando um atleta/profissional — o texto padrão
 * ("Email address X is invalid") não deixa claro que o problema é o
 * domínio do e-mail, não um bug do sistema.
 */
export function translateAuthError(message: string): string {
  if (/is invalid$/i.test(message)) {
    return "Esse e-mail não foi aceito pelo sistema de autenticação — confira se está completo e correto (o domínio precisa existir de verdade, ex: gmail.com, hotmail.com). E-mails de teste ou domínios inexistentes são rejeitados.";
  }
  if (/already been registered|already registered/i.test(message)) {
    return "Já existe uma conta com esse e-mail no sistema.";
  }
  if (/already been invited/i.test(message)) {
    return "Esse e-mail já recebeu um convite. Peça pra pessoa checar a caixa de entrada (e spam).";
  }
  if (/rate limit/i.test(message)) {
    return "Muitos convites em pouco tempo — aguarde alguns minutos e tente de novo.";
  }
  return message;
}
