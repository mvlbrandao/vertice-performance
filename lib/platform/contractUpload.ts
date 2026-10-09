import { MAX_DOCUMENT_BYTES, PDF_MIME, formatBytes } from "@/lib/platform/contractDocumentPath";
import type { PlatformActionResult } from "@/lib/platform/auditNotice";
import type { ContractUploadTicket } from "@/lib/platform/contractSchema";

/**
 * Passos do envio do PDF do contrato, feitos NO NAVEGADOR (por isso sem
 * "server-only"). Separado do componente para a ordem das chamadas e as
 * recusas serem testadas sem um navegador: o arquivo nunca passa por server
 * action (o corpo de uma é limitado a 1 MB), então são três idas:
 *
 *   1. a action devolve a URL assinada de envio de um caminho montado no servidor;
 *   2. o navegador envia o PDF direto ao storage com o token;
 *   3. a action de confirmação confere no storage o que chegou e grava o vínculo.
 *
 * As checagens daqui (tipo, tamanho) são conforto, para não gastar um envio de
 * 10 MB à toa; o servidor repete todas no passo 3.
 */

export interface UploadableFile {
  name: string;
  type: string;
  size: number;
  slice(start?: number, end?: number, contentType?: string): Blob;
}

export interface UploadDeps {
  requestUpload(contractId: string): Promise<ContractUploadTicket>;
  uploadToSignedUrl(path: string, token: string, body: Blob): Promise<{ error: { message: string } | null }>;
  confirm(contractId: string, path: string): Promise<PlatformActionResult>;
}

export type UploadOutcome = { ok: true; warning?: string } | { ok: false; error: string };

/** Mensagem de recusa para um arquivo que não serve, ou null se pode enviar. */
export function checkPdfFile(file: Pick<UploadableFile, "name" | "type" | "size">): string | null {
  // Alguns navegadores deixam o tipo vazio para PDF; nesse caso vale a extensão.
  const looksPdf = file.type === PDF_MIME || (file.type === "" && /\.pdf$/i.test(file.name));
  if (!looksPdf) return "Envie um arquivo PDF.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `O arquivo tem ${formatBytes(file.size)}; o limite é ${formatBytes(MAX_DOCUMENT_BYTES)}.`;
  }
  return null;
}

export async function uploadContractDocument(
  deps: UploadDeps,
  contractId: string,
  file: UploadableFile,
): Promise<UploadOutcome> {
  const problem = checkPdfFile(file);
  if (problem) return { ok: false, error: problem };

  try {
    const ticket = await deps.requestUpload(contractId);
    if (ticket.error || !ticket.upload) {
      return { ok: false, error: ticket.error ?? "Não foi possível preparar o envio do arquivo." };
    }

    // Tipo vazio faria o storage ver um binário genérico e recusar; reembala
    // sem copiar o conteúdo.
    const body = file.type === PDF_MIME ? (file as unknown as Blob) : file.slice(0, file.size, PDF_MIME);
    const sent = await deps.uploadToSignedUrl(ticket.upload.path, ticket.upload.token, body);
    if (sent.error) {
      return { ok: false, error: `Não foi possível enviar o arquivo: ${sent.error.message}` };
    }

    const confirmed = await deps.confirm(contractId, ticket.upload.path);
    if (confirmed.error) return { ok: false, error: confirmed.error };
    return confirmed.warning ? { ok: true, warning: confirmed.warning } : { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível falar com o servidor. Confira a conexão e tente de novo." };
  }
}
