import { describe, expect, it, vi } from "vitest";
import { MAX_DOCUMENT_BYTES } from "@/lib/platform/contractDocumentPath";
import {
  checkPdfFile,
  uploadContractDocument,
  type UploadDeps,
  type UploadableFile,
} from "@/lib/platform/contractUpload";

const CONTRATO = "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6";
const CAMINHO = "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f/7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6/11111111-2222-4333-8444-555555555555.pdf";

function arquivo(over: Partial<{ name: string; type: string; size: number }> = {}): UploadableFile & { reembalado: string[] } {
  const reembalado: string[] = [];
  return {
    name: "contrato.pdf",
    type: "application/pdf",
    size: 2048,
    ...over,
    reembalado,
    slice: (_inicio?: number, _fim?: number, tipo?: string) => {
      reembalado.push(String(tipo));
      return new Blob(["x"], { type: tipo });
    },
  };
}

function deps(over: Partial<UploadDeps> = {}) {
  const chamadas: string[] = [];
  const completo: UploadDeps = {
    requestUpload: async (id) => {
      chamadas.push(`pedir:${id}`);
      return { success: true, upload: { path: CAMINHO, token: "tok", maxBytes: MAX_DOCUMENT_BYTES } };
    },
    uploadToSignedUrl: async (path, token) => {
      chamadas.push(`enviar:${path}:${token}`);
      return { error: null };
    },
    confirm: async (id, path) => {
      chamadas.push(`confirmar:${id}:${path}`);
      return { success: true };
    },
    ...over,
  };
  return { deps: completo, chamadas };
}

describe("checkPdfFile", () => {
  it("aceita PDF, inclusive exatamente 10 MB", () => {
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: 1 })).toBeNull();
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
  });

  it("tipo vazio vale pela extensão .pdf (qualquer caixa)", () => {
    expect(checkPdfFile({ name: "contrato.PDF", type: "", size: 10 })).toBeNull();
    expect(checkPdfFile({ name: "contrato.exe", type: "", size: 10 })).toBe("Envie um arquivo PDF.");
  });

  it("recusa outros tipos, mesmo com nome .pdf", () => {
    expect(checkPdfFile({ name: "foto.pdf", type: "image/png", size: 10 })).toBe("Envie um arquivo PDF.");
    expect(checkPdfFile({ name: "a.docx", type: "application/msword", size: 10 })).toBe("Envie um arquivo PDF.");
  });

  it("recusa vazio e acima de 10 MB, dizendo o limite", () => {
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe("O arquivo está vazio.");
    const grande = checkPdfFile({ name: "a.pdf", type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 });
    expect(grande).toContain("10 MB");
  });
});

describe("uploadContractDocument", () => {
  it("pede o passe, envia direto ao storage e só então confirma, nessa ordem", async () => {
    const { deps: d, chamadas } = deps();
    const r = await uploadContractDocument(d, CONTRATO, arquivo());
    expect(r).toEqual({ ok: true });
    expect(chamadas).toEqual([`pedir:${CONTRATO}`, `enviar:${CAMINHO}:tok`, `confirmar:${CONTRATO}:${CAMINHO}`]);
  });

  it("usa o caminho devolvido pelo servidor, não algo montado no navegador", async () => {
    const { deps: d, chamadas } = deps();
    await uploadContractDocument(d, CONTRATO, arquivo({ name: "../../etc/passwd.pdf" }));
    expect(chamadas[1]).toBe(`enviar:${CAMINHO}:tok`);
    expect(chamadas.join("|")).not.toContain("passwd");
  });

  it("arquivo recusado no navegador nem chega a falar com o servidor", async () => {
    const { deps: d, chamadas } = deps();
    const r = await uploadContractDocument(d, CONTRATO, arquivo({ type: "image/png", name: "a.png" }));
    expect(r).toEqual({ ok: false, error: "Envie um arquivo PDF." });
    expect(chamadas).toEqual([]);
  });

  it("servidor recusa o pedido (contrato encerrado, bucket ausente...): não envia nada", async () => {
    const { deps: d, chamadas } = deps({
      requestUpload: async () => ({ error: "O CT-1 está encerrado e é somente leitura." }),
    });
    const r = await uploadContractDocument(d, CONTRATO, arquivo());
    expect(r).toEqual({ ok: false, error: "O CT-1 está encerrado e é somente leitura." });
    expect(chamadas).toEqual([]);
  });

  it("passe sem dados de envio vira erro genérico", async () => {
    const { deps: d } = deps({ requestUpload: async () => ({ success: true }) });
    const r = await uploadContractDocument(d, CONTRATO, arquivo());
    expect(r.ok).toBe(false);
  });

  it("falha no envio ao storage: não confirma", async () => {
    const confirm = vi.fn();
    const { deps: d } = deps({
      uploadToSignedUrl: async () => ({ error: { message: "The object exceeded the maximum allowed size" } }),
      confirm,
    });
    const r = await uploadContractDocument(d, CONTRATO, arquivo());
    expect(r).toEqual({ ok: false, error: "Não foi possível enviar o arquivo: The object exceeded the maximum allowed size" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a confirmação do servidor pode recusar (não é PDF de verdade, passou do tamanho)", async () => {
    const { deps: d } = deps({ confirm: async () => ({ error: "O arquivo enviado não é um PDF." }) });
    const r = await uploadContractDocument(d, CONTRATO, arquivo());
    expect(r).toEqual({ ok: false, error: "O arquivo enviado não é um PDF." });
  });

  it("repassa o aviso da trilha (a ação valeu, mas não foi registrada)", async () => {
    const { deps: d } = deps({ confirm: async () => ({ success: true, warning: "NÃO foi registrada" }) });
    expect(await uploadContractDocument(d, CONTRATO, arquivo())).toEqual({ ok: true, warning: "NÃO foi registrada" });
  });

  it("queda de rede em qualquer passo vira mensagem, nunca exceção", async () => {
    for (const passo of ["requestUpload", "uploadToSignedUrl", "confirm"] as const) {
      const { deps: d } = deps({
        [passo]: async () => {
          throw new Error("Failed to fetch");
        },
      });
      const r = await uploadContractDocument(d, CONTRATO, arquivo());
      expect(r.ok, passo).toBe(false);
      expect(r.ok === false && r.error).toContain("Não foi possível falar com o servidor");
    }
  });

  it("tipo vazio é reembalado como PDF antes de enviar; tipo correto segue como está", async () => {
    const enviados: Blob[] = [];
    const { deps: d } = deps({
      uploadToSignedUrl: async (_p, _t, body) => {
        enviados.push(body);
        return { error: null };
      },
    });

    const vazio = arquivo({ type: "", name: "contrato.pdf" });
    await uploadContractDocument(d, CONTRATO, vazio);
    expect(vazio.reembalado).toEqual(["application/pdf"]);
    expect(enviados[0].type).toBe("application/pdf");

    const certo = arquivo();
    await uploadContractDocument(d, CONTRATO, certo);
    expect(certo.reembalado).toEqual([]);
  });
});
