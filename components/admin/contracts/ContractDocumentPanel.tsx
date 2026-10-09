"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  confirmContractDocument,
  getContractDocumentUrl,
  removeContractDocument,
  requestContractDocumentUpload,
} from "@/lib/actions/contracts";
import {
  CONTRACT_BUCKET,
  MAX_DOCUMENT_BYTES,
  PDF_MIME,
  documentDownloadName,
  formatBytes,
} from "@/lib/platform/contractDocumentPath";
import { uploadContractDocument } from "@/lib/platform/contractUpload";
import { createClient } from "@/lib/supabase/client";

/**
 * Documento assinado (PDF) do contrato.
 *
 * O arquivo NÃO passa por server action (o corpo de uma é limitado a 1 MB):
 * 1) a action devolve uma URL assinada de envio para um caminho montado no
 *    servidor; 2) o navegador envia o PDF direto ao storage; 3) a action de
 *    confirmação confere no storage o que de fato chegou e só então grava o
 *    vínculo. Qualquer verificação feita aqui (tipo, tamanho) é só conforto: o
 *    servidor repete todas.
 */
export function ContractDocumentPanel({
  contractId,
  number,
  hasDocument,
  editable,
}: {
  contractId: string;
  number: number;
  hasDocument: boolean;
  /** Rascunho e vigente enviam, trocam e removem; encerrado e cancelado só baixam. */
  editable: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "enviando" | "baixando" | "removendo">(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function reset() {
    setError(null);
    setWarning(null);
    setNotice(null);
  }

  async function upload(file: File) {
    reset();
    setBusy("enviando");
    const outcome = await uploadContractDocument(
      {
        requestUpload: requestContractDocumentUpload,
        uploadToSignedUrl: (path, token, body) =>
          createClient().storage.from(CONTRACT_BUCKET).uploadToSignedUrl(path, token, body, { contentType: PDF_MIME }),
        confirm: confirmContractDocument,
      },
      contractId,
      file,
    );
    setBusy(null);
    // Permite escolher o mesmo arquivo de novo depois de um erro.
    if (inputRef.current) inputRef.current.value = "";

    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    if (outcome.warning) setWarning(outcome.warning);
    setNotice(hasDocument ? "Documento substituído." : "Documento anexado.");
    router.refresh();
  }

  async function download() {
    reset();
    setBusy("baixando");
    try {
      const link = await getContractDocumentUrl(contractId);
      if (link.error || !link.url) {
        setError(link.error ?? "Não foi possível gerar o link do documento.");
        return;
      }
      // O link expira em 60 s e vem com Content-Disposition de download: a
      // navegação baixa o arquivo sem tirar a pessoa desta página.
      window.location.assign(link.url);
    } catch {
      setError("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    reset();
    setBusy("removendo");
    try {
      const result = await removeContractDocument(contractId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.warning) setWarning(result.warning);
      setConfirmRemove(false);
      setNotice("Documento removido.");
      router.refresh();
    } catch {
      setError("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px]">
        {hasDocument ? (
          <>
            <b>PDF assinado anexado.</b> <span className="text-ink-faint">({documentDownloadName(number)})</span>
          </>
        ) : (
          <span className="text-ink-soft">Nenhum documento anexado.</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {hasDocument && (
          <Button variant="outline" size="sm" type="button" disabled={disabled} onClick={download}>
            {busy === "baixando" ? "Gerando link…" : "Baixar"}
          </Button>
        )}
        {editable && (
          <>
            <Button
              variant={hasDocument ? "outline" : "solid"}
              size="sm"
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {busy === "enviando" ? "Enviando…" : hasDocument ? "Substituir PDF" : "Enviar PDF"}
            </Button>
            {hasDocument && (
              <Button
                variant="danger"
                size="sm"
                type="button"
                disabled={disabled}
                aria-expanded={confirmRemove}
                onClick={() => setConfirmRemove((v) => !v)}
              >
                Remover
              </Button>
            )}
          </>
        )}
      </div>

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher o PDF do contrato"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      )}

      {confirmRemove && (
        <div className="rounded-sm border border-line bg-chalk p-3.5 flex flex-col gap-2.5">
          <p className="m-0 text-[13px]">Remover o PDF deste contrato? O arquivo é apagado do armazenamento.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={remove}>
              {busy === "removendo" ? "Removendo…" : "Remover documento"}
            </Button>
            <Button variant="ghost" size="sm" type="button" disabled={disabled} onClick={() => setConfirmRemove(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {editable && (
        <p className="m-0 text-[11.5px] text-ink-faint">Somente PDF, até {formatBytes(MAX_DOCUMENT_BYTES)}.</p>
      )}

      {error && (
        <p role="alert" className="m-0 text-[13px] text-clay font-medium">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="m-0 text-[12.5px] font-semibold">
          ✓ {notice}
        </p>
      )}
      {warning && (
        <p role="alert" className="text-[12.5px] font-medium m-0 px-3 py-2 rounded-sm border border-amber bg-[#FFFBE6]">
          {warning}
        </p>
      )}
    </div>
  );
}
