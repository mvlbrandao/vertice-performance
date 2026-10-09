import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  buildDocumentPath,
  documentDownloadName,
  documentFolder,
  formatBytes,
  isBucketMissingError,
  isInContractFolder,
  isOwnDocumentPath,
  validateUploadedObject,
} from "@/lib/platform/contractDocumentPath";

const CLUB = "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f";
const OUTRO_CLUBE = "aaaaaaaa-8a47-4d1e-9c55-0a1b2c3d4e5f";
const CONTRACT = "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6";
const OUTRO_CONTRATO = "bbbbbbbb-4b5c-4d6e-8f70-a1b2c3d4e5f6";
const FILE = "11111111-2222-4333-8444-555555555555";

describe("caminho do documento", () => {
  it("monta {club}/{contrato}/{uuid}.pdf, sempre no servidor", () => {
    expect(buildDocumentPath(CLUB, CONTRACT, FILE)).toBe(`${CLUB}/${CONTRACT}/${FILE}.pdf`);
    expect(documentFolder(CLUB, CONTRACT)).toBe(`${CLUB}/${CONTRACT}/`);
  });

  it("o caminho montado é aceito pelo validador do mesmo contrato", () => {
    expect(isOwnDocumentPath(buildDocumentPath(CLUB, CONTRACT, FILE), CLUB, CONTRACT)).toBe(true);
  });
});

describe("isOwnDocumentPath: o que o servidor aceita gravar em document_path", () => {
  const ok = `${CLUB}/${CONTRACT}/${FILE}.pdf`;

  it("aceita só o formato exato", () => {
    expect(isOwnDocumentPath(ok, CLUB, CONTRACT)).toBe(true);
  });

  it("recusa pasta de outro clube ou de outro contrato", () => {
    expect(isOwnDocumentPath(ok, OUTRO_CLUBE, CONTRACT)).toBe(false);
    expect(isOwnDocumentPath(ok, CLUB, OUTRO_CONTRATO)).toBe(false);
    expect(isOwnDocumentPath(`${OUTRO_CLUBE}/${CONTRACT}/${FILE}.pdf`, CLUB, CONTRACT)).toBe(false);
  });

  it("recusa travessia de diretório, subpastas e barras extras", () => {
    for (const ruim of [
      `${CLUB}/${CONTRACT}/../${OUTRO_CONTRATO}/${FILE}.pdf`,
      `${CLUB}/${CONTRACT}/../../${OUTRO_CLUBE}/x/${FILE}.pdf`,
      `${CLUB}/${CONTRACT}//${FILE}.pdf`,
      `${CLUB}/${CONTRACT}/sub/${FILE}.pdf`,
      `/${CLUB}/${CONTRACT}/${FILE}.pdf`,
      `${CLUB}/${CONTRACT}/${FILE}.pdf/`,
      `${CLUB}\\${CONTRACT}\\${FILE}.pdf`,
    ]) {
      expect(isOwnDocumentPath(ruim, CLUB, CONTRACT), ruim).toBe(false);
    }
  });

  it("recusa nome de arquivo que não seja um uuid.pdf", () => {
    for (const nome of ["contrato.pdf", `${FILE}.PDF`, `${FILE}.exe`, `${FILE}.pdf.exe`, `${FILE}`, ".pdf", ""]) {
      expect(isOwnDocumentPath(`${CLUB}/${CONTRACT}/${nome}`, CLUB, CONTRACT), nome).toBe(false);
    }
  });

  it("recusa o que não é texto", () => {
    expect(isOwnDocumentPath(undefined, CLUB, CONTRACT)).toBe(false);
    expect(isOwnDocumentPath(null, CLUB, CONTRACT)).toBe(false);
    expect(isOwnDocumentPath(["a"], CLUB, CONTRACT)).toBe(false);
  });

  it("o prefixo vale mesmo com ids parecidos (prefixo de outro id não passa)", () => {
    expect(isOwnDocumentPath(`${CLUB}/${CONTRACT}x/${FILE}.pdf`, CLUB, CONTRACT)).toBe(false);
  });
});

describe("isInContractFolder: leitura de documento já gravado", () => {
  it("aceita qualquer arquivo simples dentro da pasta do contrato", () => {
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/antigo.pdf`, CLUB, CONTRACT)).toBe(true);
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/${FILE}.pdf`, CLUB, CONTRACT)).toBe(true);
  });

  it("recusa fora da pasta, vazio e travessia", () => {
    expect(isInContractFolder(`${OUTRO_CLUBE}/${CONTRACT}/a.pdf`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(`${CLUB}/${OUTRO_CONTRATO}/a.pdf`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/../x.pdf`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/a/b.pdf`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(`${CLUB}/${CONTRACT}/a\\b.pdf`, CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder("outro/lugar.pdf", CLUB, CONTRACT)).toBe(false);
    expect(isInContractFolder(null, CLUB, CONTRACT)).toBe(false);
  });
});

describe("validateUploadedObject", () => {
  const pdf = { size: 1024, contentType: "application/pdf" };

  it("aceita PDF dentro do limite, inclusive exatamente 10 MB", () => {
    expect(validateUploadedObject(pdf)).toBeNull();
    expect(validateUploadedObject({ ...pdf, size: MAX_DOCUMENT_BYTES })).toBeNull();
  });

  it("recusa 1 byte acima de 10 MB", () => {
    expect(validateUploadedObject({ ...pdf, size: MAX_DOCUMENT_BYTES + 1 })).toContain("limite");
  });

  it("recusa vazio e tamanho desconhecido", () => {
    expect(validateUploadedObject({ ...pdf, size: 0 })).toContain("vazio");
    expect(validateUploadedObject({ ...pdf, size: null })).toContain("tamanho");
    expect(validateUploadedObject({ ...pdf, size: Number.NaN })).toContain("tamanho");
  });

  it("recusa o que não é PDF, ou sem tipo", () => {
    for (const contentType of ["image/png", "text/html", "application/octet-stream", "", null]) {
      expect(validateUploadedObject({ size: 100, contentType }), String(contentType)).toBe(
        "O arquivo enviado não é um PDF.",
      );
    }
  });

  it("ignora parâmetros e caixa do tipo", () => {
    expect(validateUploadedObject({ size: 100, contentType: "Application/PDF; charset=binary" })).toBeNull();
  });
});

describe("utilitários", () => {
  it("formatBytes", () => {
    expect(formatBytes(850)).toBe("850 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(MAX_DOCUMENT_BYTES)).toBe("10 MB");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("nome do download", () => {
    expect(documentDownloadName(7)).toBe("contrato-CT-7.pdf");
  });

  it("detecta bucket ausente pela mensagem do storage", () => {
    expect(isBucketMissingError({ message: "Bucket not found" })).toBe(true);
    expect(isBucketMissingError({ message: "bucket NOT FOUND" })).toBe(true);
    expect(isBucketMissingError({ message: "Object not found" })).toBe(false);
    expect(isBucketMissingError(null)).toBe(false);
    expect(isBucketMissingError({})).toBe(false);
  });

  it("o limite é o mesmo do bucket (10485760)", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10_485_760);
  });
});
