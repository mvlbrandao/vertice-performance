import "server-only";
import type { AsaasCredentials } from "@/lib/asaas/credentials";
import { baseUrlForKey } from "@/lib/asaas/credentials";

/**
 * A conta Asaas *da plataforma* — a nossa, usada para cobrar a mensalidade
 * dos clubes. Continua vindo do ambiente, e é o único lugar que ainda lê
 * ASAAS_API_KEY.
 *
 * Não confundir com a conta de cada clube (lib/asaas/credentials.ts), que
 * serve pro clube cobrar os responsáveis. São dois sentidos de dinheiro
 * diferentes, e misturá-los foi exatamente o problema que motivou a
 * separação: nós cobramos o clube, o clube cobra as famílias.
 */
export function getPlatformAsaasCredentials(): AsaasCredentials | null {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.ASAAS_API_BASE_URL ?? baseUrlForKey(apiKey),
  };
}
