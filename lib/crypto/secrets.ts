import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * Cifra segredos de terceiros antes de gravar no banco — hoje, a chave da
 * conta Asaas de cada clube.
 *
 * Por que cifrar, se a tabela já é inacessível por RLS: são credenciais de
 * OUTRAS empresas, e elas movem dinheiro. RLS protege o acesso pela API;
 * não protege um dump de backup vazado, nem um engano numa consulta feita
 * com service role. Cifrar cobre esse caso — quem levar o banco não leva as
 * chaves junto, porque a chave de cifragem vive só no ambiente do servidor.
 *
 * AES-256-GCM: além de cifrar, autentica. Se alguém alterar o valor no
 * banco, a decifragem falha em vez de devolver lixo silenciosamente.
 */
const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "[crypto] CREDENTIALS_ENCRYPTION_KEY ausente. Sem ela não dá pra ler nem gravar credencial de clube.",
    );
  }
  // Aceita a chave em qualquer formato e deriva 32 bytes: assim uma troca
  // de formato no ambiente não quebra a decifragem do que já está gravado.
  return createHash("sha256").update(raw).digest();
}

/** Devolve "iv.tagDeAutenticacao.textoCifrado", tudo em base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("[crypto] Credencial gravada em formato inesperado.");
  }
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Só os últimos caracteres, pra tela confirmar qual chave está conectada
 * sem nunca mostrar a chave. O resto do valor não volta pro navegador.
 */
export function maskSecret(plain: string): string {
  return plain.length <= 6 ? "••••" : `••••${plain.slice(-6)}`;
}
