/**
 * Regras do documento assinado do contrato (PDF no bucket privado
 * club-contracts, migração 0073). Puras, sem "server-only": o caminho do
 * arquivo é decisão de segurança e precisa de teste.
 *
 * O bucket não tem política em storage.objects: só a service role acessa.
 * Então quem garante que um contrato aponta apenas para arquivos DELE é este
 * código, e a garantia é o prefixo {club_id}/{contract_id}/ montado no
 * servidor, nunca vindo do navegador.
 */

export const CONTRACT_BUCKET = "club-contracts";

/** Mesmo limite do bucket (file_size_limit = 10485760). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const PDF_MIME = "application/pdf";

export const BUCKET_MISSING_MESSAGE =
  "O armazenamento de contratos (bucket club-contracts) não existe neste projeto. Aplique a migração 0073 e tente de novo.";

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FILE_NAME = new RegExp(`^${UUID_SOURCE}\\.pdf$`);

/** Pasta do contrato dentro do bucket, com a barra final. */
export function documentFolder(clubId: string, contractId: string): string {
  return `${clubId}/${contractId}/`;
}

/** Caminho de um arquivo novo: o nome é um uuid gerado no servidor, nunca o nome que a pessoa deu. */
export function buildDocumentPath(clubId: string, contractId: string, fileId: string): string {
  return `${documentFolder(clubId, contractId)}${fileId}.pdf`;
}

/**
 * Caminho que o servidor aceita gravar em document_path: exatamente
 * {club_id}/{contract_id}/{uuid}.pdf. Rígido de propósito: "..", barras extras
 * ou outro nome de arquivo ficam de fora.
 */
export function isOwnDocumentPath(path: unknown, clubId: string, contractId: string): path is string {
  if (typeof path !== "string") return false;
  const folder = documentFolder(clubId, contractId);
  return path.startsWith(folder) && FILE_NAME.test(path.slice(folder.length));
}

/**
 * Caminho já gravado que ainda está dentro da pasta do contrato. Mais
 * tolerante que isOwnDocumentPath (aceita qualquer nome de arquivo simples)
 * para não travar a leitura de um documento antigo, mas continua barrando
 * qualquer coisa fora da pasta: a service role lê o bucket inteiro, então um
 * document_path adulterado não pode virar leitura de arquivo de outro clube.
 */
export function isInContractFolder(path: unknown, clubId: string, contractId: string): path is string {
  if (typeof path !== "string") return false;
  const folder = documentFolder(clubId, contractId);
  if (!path.startsWith(folder)) return false;
  const rest = path.slice(folder.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..") && !rest.includes("\\");
}

/** Nome sugerido ao baixar: "contrato-CT-7.pdf". */
export function documentDownloadName(number: number): string {
  return `contrato-CT-${number}.pdf`;
}

/** "1,2 MB", "340 KB", "850 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const format = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) return `${format(bytes / 1024)} KB`;
  return `${format(bytes / (1024 * 1024))} MB`;
}

export interface UploadedObject {
  size: number | null;
  contentType: string | null;
}

/**
 * O objeto que chegou ao storage serve como documento? Devolve a mensagem de
 * recusa, ou null se está tudo certo. O bucket já recusa o que não é PDF e o
 * que passa de 10 MB, mas o tipo vem do que o navegador DECLAROU no envio, e a
 * confirmação não pode depender só disso: confere de novo o que o storage
 * realmente guardou.
 */
export function validateUploadedObject(object: UploadedObject): string | null {
  if (object.size === null || !Number.isFinite(object.size)) {
    return "Não foi possível conferir o tamanho do arquivo enviado. Envie de novo.";
  }
  if (object.size <= 0) return "O arquivo enviado está vazio.";
  if (object.size > MAX_DOCUMENT_BYTES) {
    return `O arquivo tem ${formatBytes(object.size)}; o limite é ${formatBytes(MAX_DOCUMENT_BYTES)}.`;
  }
  // Ignora parâmetros ("application/pdf; charset=...") e maiúsculas.
  const type = (object.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type !== PDF_MIME) return "O arquivo enviado não é um PDF.";
  return null;
}

/** O erro do storage-js diz que o bucket não existe? */
export function isBucketMissingError(error: { message?: string } | null | undefined): boolean {
  return /bucket not found/i.test(error?.message ?? "");
}
