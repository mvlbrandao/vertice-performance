import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Invalida toda a área de administração depois de uma mutação. Camada
 * "layout" de propósito: uma ação do painel muda ao mesmo tempo a visão
 * geral, a lista de clubes, a ficha do clube e a trilha de auditoria (que
 * ganha uma linha a cada ação), e listar página por página deixaria uma delas
 * mostrando dado velho quando alguém criasse uma tela nova.
 */
export function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}
