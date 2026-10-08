import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdmin } from "@/lib/platform/admin";
import { isMissingRelation } from "@/lib/platform/contracts";
import { normalizeAuditDetails } from "@/lib/platform/auditDetails";
import { isValidAuditAction } from "@/lib/platform/auditLabels";

export interface PlatformActionEntry {
  /** "<entidade>.<verbo>", ex.: club.set_status. */
  action: string;
  /** Clube afetado, quando houver. O nome vai junto como retrato: o clube pode ser expurgado. */
  club?: { id: string; name: string | null };
  details?: Record<string, unknown>;
}

/** x-forwarded-for pode vir como lista ("cliente, proxy1, proxy2"): vale o primeiro. */
async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    // A coluna é texto livre e o cabeçalho vem de fora: limita o tamanho.
    return ip ? ip.slice(0, 64) : null;
  } catch {
    return null;
  }
}

/**
 * Registra uma ação do administrador na trilha da plataforma
 * (platform_audit_log, migração 0072).
 *
 * Chamar com `await`, DEPOIS da mutação. Sem o await a função serverless pode
 * ser encerrada antes da gravação; e esta função nunca lança, então o await
 * não traz risco. A ação principal já aconteceu — o preço mudou, o clube foi
 * bloqueado — e uma falha ao anotar não pode desfazê-la nem fazer a tela
 * mostrar erro de algo que deu certo.
 *
 * Devolve `true` só quando a linha foi gravada. Quem chama repassa isso à
 * tela (successResult em auditNotice.ts): a falha vai para o log do servidor
 * E vira aviso para o administrador, porque uma trilha que falha em silêncio
 * deixa a pessoa achar que a ação ficou registrada.
 *
 * Enquanto a migração 0072 não for aplicada a tabela não existe: isso é
 * esperado e vira aviso no log, não erro — mas continua devolvendo `false`.
 *
 * `details`: para mudanças, use `{ changes: diffFields(antes, depois) }` — só
 * os campos que mudaram, com from/to. Nunca coloque segredo (chave de API,
 * token, CPF/CNPJ); normalizeAuditDetails remove o que tiver cara de
 * credencial, mas é a última barreira, não a primeira.
 */
export async function logPlatformAction(entry: PlatformActionEntry): Promise<boolean> {
  try {
    if (!isValidAuditAction(entry.action)) {
      console.error(`[auditoria] ação fora do formato entidade.verbo, não gravada: ${entry.action}`);
      return false;
    }

    const actor = await getPlatformAdmin();
    if (!actor) {
      // Não deveria acontecer: toda ação passa por requirePlatformAdmin antes.
      console.error(`[auditoria] ação ${entry.action} sem administrador na sessão; trilha NÃO gravada.`);
      return false;
    }

    const admin = createAdminClient();
    const { error } = await admin.from("platform_audit_log").insert({
      actor_user_id: actor.userId,
      actor_email: actor.email,
      action: entry.action,
      target_club_id: entry.club?.id ?? null,
      target_club_name: entry.club?.name ?? null,
      details: normalizeAuditDetails(entry.details),
      ip: await requestIp(),
    });

    if (!error) return true;

    if (isMissingRelation(error)) {
      console.warn(
        `[auditoria] tabela platform_audit_log ausente (migração 0072 pendente): ${entry.action} não foi registrada.`,
      );
      return false;
    }
    console.error(`[auditoria] falha ao gravar ${entry.action}:`, error.message);
    return false;
  } catch (e) {
    console.error(`[auditoria] erro inesperado ao gravar ${entry.action}:`, (e as Error).message);
    return false;
  }
}

/**
 * A trilha existe no banco? Para as telas que alteram coisas dizerem a
 * verdade (hoje a 0072 ainda não está em produção). Erro que não seja
 * "tabela ausente" conta como existente: uma falha passageira de rede não
 * pode virar um aviso falso de migração pendente.
 */
export async function isAuditTrailAvailable(): Promise<boolean> {
  const { error } = await createAdminClient().from("platform_audit_log").select("id").limit(1);
  return !isMissingRelation(error);
}
