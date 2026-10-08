import type { ActionResult } from "@/lib/actions/athletes";

/**
 * Resultado de uma ação do painel de administração: o de sempre, mais um
 * `warning` para o que deu certo mas a pessoa precisa saber. Sem isto a tela
 * mostraria sucesso limpo mesmo quando a trilha de auditoria não gravou.
 *
 * Fica fora de audit.ts (que importa "server-only") para o cliente poder
 * importar o tipo e o teste conseguir carregar a lógica.
 */
export interface PlatformActionResult extends ActionResult {
  warning?: string;
}

/**
 * A mutação já aconteceu e não dá para desfazê-la só porque a anotação
 * falhou (ver logPlatformAction). Mas a trilha é o único controle detetivo
 * da conta de administrador, então a falha tem de aparecer na tela, não só
 * no log do servidor.
 */
export const AUDIT_NOT_RECORDED_WARNING =
  "Ação feita, mas NÃO foi registrada na trilha de auditoria. Confira se a migração 0072 foi aplicada e veja o log do servidor.";

/** Sucesso da ação; `auditRecorded` é o que logPlatformAction devolveu. */
export function successResult(auditRecorded: boolean): PlatformActionResult {
  return auditRecorded ? { success: true } : { success: true, warning: AUDIT_NOT_RECORDED_WARNING };
}
