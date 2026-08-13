import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";

/**
 * Resolve qual conta Asaas usar para um clube.
 *
 * Antes existia uma chave só, no ambiente — a nossa. Com um cliente isso
 * passava, porque o clube era nosso. No segundo, a mensalidade paga pela
 * mãe do atleta cairia na nossa conta bancária, e viraríamos intermediários
 * do dinheiro dos outros. Agora cada clube conecta a própria conta.
 *
 * A credencial vive em club_asaas_credentials, tabela com RLS e nenhuma
 * policy: só a service role alcança. Por isso a leitura passa por aqui, no
 * servidor, e nunca por uma consulta feita com a sessão do usuário.
 */
export interface AsaasCredentials {
  apiKey: string;
  baseUrl: string;
}

/** Sandbox e produção têm endereços diferentes; a chave denuncia qual é. */
export function baseUrlForKey(apiKey: string): string {
  return apiKey.includes("_hmlg_")
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

export function isSandboxKey(apiKey: string): boolean {
  return apiKey.includes("_hmlg_");
}

export async function getClubAsaasCredentials(clubId: string): Promise<AsaasCredentials | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_asaas_credentials")
    .select("api_key_encrypted")
    .eq("club_id", clubId)
    .maybeSingle();

  // Erro de consulta não é "clube sem conta conectada". Confundir os dois
  // faria o sistema dizer que falta configurar quando o problema é outro.
  if (error) throw new Error(`Falha ao ler a credencial do clube: ${error.message}`);
  if (!data) return null;

  const apiKey = decryptSecret(data.api_key_encrypted);
  return { apiKey, baseUrl: baseUrlForKey(apiKey) };
}

/**
 * Grava a chave cifrada e devolve o token de webhook do clube, criando um
 * na primeira conexão. Cada clube precisa do seu: com uma rota única não
 * havia como saber de qual conta veio o evento, e aceitar evento sem saber
 * de quem é significa deixar qualquer um marcar cobrança como paga.
 */
export async function saveClubAsaasCredentials(clubId: string, apiKey: string): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("club_asaas_credentials")
    .select("webhook_token")
    .eq("club_id", clubId)
    .maybeSingle();

  const webhookToken = existing?.webhook_token ?? randomBytes(24).toString("base64url");

  const { error } = await admin.from("club_asaas_credentials").upsert(
    {
      club_id: clubId,
      api_key_encrypted: encryptSecret(apiKey),
      webhook_token: webhookToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "club_id" },
  );
  if (error) throw new Error(`Falha ao gravar a credencial: ${error.message}`);

  return webhookToken;
}

export async function disconnectClubAsaas(clubId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("club_asaas_credentials").delete().eq("club_id", clubId);
  if (error) throw new Error(`Falha ao desconectar: ${error.message}`);
}

/** Resolve o clube a partir do token que veio na URL do webhook. */
export async function clubIdForWebhookToken(token: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_asaas_credentials")
    .select("club_id")
    .eq("webhook_token", token)
    .maybeSingle();
  if (error) throw new Error(`Falha ao resolver o webhook: ${error.message}`);
  return data?.club_id ?? null;
}
