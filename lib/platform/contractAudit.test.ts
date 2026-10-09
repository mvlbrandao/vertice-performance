import { describe, expect, it } from "vitest";
import {
  AUDIT_NOTES_MAX,
  contractChanges,
  presentContractAuditDetails,
  sanitizeAuditValue,
  truncateForAudit,
} from "@/lib/platform/contractAudit";
import { describeAuditDetails } from "@/lib/platform/auditLabels";

describe("truncateForAudit", () => {
  it("não mexe em texto curto; corta o longo com reticências", () => {
    expect(truncateForAudit("curto")).toBe("curto");
    expect(truncateForAudit("a".repeat(AUDIT_NOTES_MAX))).toHaveLength(AUDIT_NOTES_MAX);
    const cortado = truncateForAudit("a".repeat(AUDIT_NOTES_MAX + 1));
    expect(cortado).toHaveLength(AUDIT_NOTES_MAX + 1);
    expect(cortado.endsWith("…")).toBe(true);
  });
});

describe("sanitizeAuditValue", () => {
  it("nome de quem assinou nunca vai para a trilha imutável", () => {
    expect(sanitizeAuditValue("signer_name", "Maria da Silva")).toBe("(omitido)");
    expect(sanitizeAuditValue("signer_name", null)).toBeNull();
  });

  it("notas internas são truncadas; outros campos passam como vieram", () => {
    const longa = "x".repeat(1000);
    expect((sanitizeAuditValue("notes", longa) as string).length).toBeLessThanOrEqual(AUDIT_NOTES_MAX + 1);
    expect(sanitizeAuditValue("plan_name", "Plano")).toBe("Plano");
    expect(sanitizeAuditValue("price_cents", 100)).toBe(100);
    expect(sanitizeAuditValue("auto_renew", false)).toBe(false);
    expect(sanitizeAuditValue("ends_on", undefined)).toBeNull();
  });
});

describe("contractChanges", () => {
  it("só devolve o que mudou, com de/para", () => {
    expect(
      contractChanges(
        { plan_name: "A", price_cents: 100, ends_on: "2026-12-31" },
        { plan_name: "A", price_cents: 200, ends_on: "2026-12-31" },
      ),
    ).toEqual({ price_cents: { from: 100, to: 200 } });
  });

  it("nada mudou = objeto vazio (a ação não polui a trilha)", () => {
    expect(contractChanges({ a: 1, b: null }, { a: 1, b: null })).toEqual({});
    // undefined e null são o mesmo "vazio".
    expect(contractChanges({ a: undefined }, { a: null })).toEqual({});
  });

  it("false não é o mesmo que vazio", () => {
    expect(contractChanges({ auto_renew: true }, { auto_renew: false })).toEqual({
      auto_renew: { from: true, to: false },
    });
    expect(contractChanges({}, { auto_renew: false })).toEqual({ auto_renew: { from: null, to: false } });
  });

  it("compara o texto COMPLETO das notas antes de truncar", () => {
    const base = "x".repeat(AUDIT_NOTES_MAX + 10);
    const mudou = contractChanges({ notes: `${base}A` }, { notes: `${base}B` });
    // A mudança acontece depois do corte, mas é detectada; o valor gravado é o truncado.
    expect(Object.keys(mudou)).toEqual(["notes"]);
    expect((mudou.notes.to as string).length).toBeLessThanOrEqual(AUDIT_NOTES_MAX + 1);
    expect(JSON.stringify(mudou)).not.toContain(`${base}B`);
  });

  it("nome de quem assinou trocado: registra que mudou, sem gravar nenhum dos nomes", () => {
    const r = contractChanges({ signer_name: "Ana" }, { signer_name: "Beto" });
    expect(r).toEqual({ signer_name: { from: "(omitido)", to: "(omitido)" } });
    expect(JSON.stringify(r)).not.toContain("Ana");
    expect(JSON.stringify(r)).not.toContain("Beto");
  });

  it("nome de quem assinou preenchido pela primeira vez", () => {
    expect(contractChanges({ signer_name: null }, { signer_name: "Ana" })).toEqual({
      signer_name: { from: null, to: "(omitido)" },
    });
  });

  it("só olha as chaves do 'depois'", () => {
    expect(contractChanges({ a: 1, so_antes: 2 }, { a: 1 })).toEqual({});
  });
});

describe("presentContractAuditDetails", () => {
  it("passa adiante o que não conhece, sem quebrar", () => {
    expect(presentContractAuditDetails(null)).toBeNull();
    expect(presentContractAuditDetails("texto")).toBe("texto");
    expect(presentContractAuditDetails([1, 2])).toEqual([1, 2]);
  });

  it("traduz rótulos e formata dinheiro, datas, ciclo e situação", () => {
    const out = presentContractAuditDetails({
      contractId: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6",
      number: 7,
      changes: {
        price_cents: { from: 14990, to: 120000 },
        billing_cycle: { from: "mensal", to: "anual" },
        starts_on: { from: "2026-10-01", to: "2026-11-01" },
        ends_on: { from: null, to: "2027-10-31" },
        max_athletes: { from: null, to: 80 },
        status: { from: "rascunho", to: "vigente" },
        auto_renew: { from: true, to: false },
        document_path: { from: null, to: "x/y/z.pdf" },
      },
    }) as { changes: Record<string, { from: unknown; to: unknown }> } & Record<string, unknown>;

    expect(out.Contrato).toBe("CT-7");
    expect(out).not.toHaveProperty("contractId");
    expect(out.changes["Valor por ciclo"]).toEqual({
      from: expect.stringContaining("149,90"),
      to: expect.stringContaining("1.200,00"),
    });
    expect(out.changes["Ciclo de cobrança"]).toEqual({ from: "Mensal", to: "Anual" });
    expect(out.changes["Início"]).toEqual({ from: "01/10/2026", to: "01/11/2026" });
    expect(out.changes["Fim"]).toEqual({ from: "indeterminado", to: "31/10/2027" });
    expect(out.changes["Cota de atletas"]).toEqual({ from: "padrão da plataforma", to: 80 });
    expect(out.changes["Situação"]).toEqual({ from: "Rascunho", to: "Vigente" });
    expect(out.changes["Documento"]).toEqual({ from: null, to: "PDF anexado" });
    // O caminho do arquivo no bucket não aparece na tela.
    expect(JSON.stringify(out)).not.toContain("x/y/z.pdf");
  });

  it("mostra os fatos soltos com rótulo: motivo, substituição, renovação, tamanho", () => {
    const out = presentContractAuditDetails({
      number: 2,
      reason: "Substituído pelo CT-3",
      replacedBy: 3,
      replaces: 1,
      renewedFrom: 1,
      sizeBytes: 2048,
    }) as Record<string, unknown>;
    expect(out).toMatchObject({
      Contrato: "CT-2",
      Motivo: "Substituído pelo CT-3",
      "Substituído pelo": "CT-3",
      "Substitui o": "CT-1",
      "Renovação do": "CT-1",
      "Tamanho do PDF": "2 KB",
    });
  });

  it("o resultado é aceito pelo describeAuditDetails da tela de auditoria", () => {
    const linhas = describeAuditDetails(
      presentContractAuditDetails({
        number: 7,
        changes: { price_cents: { from: 14990, to: 20000 }, status: { from: "rascunho", to: "vigente" } },
      }),
    );
    expect(linhas).toContainEqual({ label: "Valor por ciclo", from: expect.stringContaining("149,90"), to: expect.stringContaining("200,00") });
    expect(linhas).toContainEqual({ label: "Situação", from: "Rascunho", to: "Vigente" });
    expect(linhas).toContainEqual({ label: "Contrato", value: "CT-7" });
  });

  it("campos desconhecidos (linha antiga) passam como vieram", () => {
    const out = presentContractAuditDetails({ changes: { campo_novo: { from: 1, to: 2 } } }) as {
      changes: Record<string, unknown>;
    };
    expect(out.changes.campo_novo).toEqual({ from: 1, to: 2 });
  });
});
