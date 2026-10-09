import { describe, expect, it } from "vitest";
import { computeContractKpis, type MetricContract } from "@/lib/platform/contractMetrics";

const HOJE = "2026-10-08";

function c(over: Partial<MetricContract>): MetricContract {
  return {
    status: "vigente",
    price_cents: 10000,
    billing_cycle: "mensal",
    ends_on: null,
    document_path: "a/b/c.pdf",
    ...over,
  };
}

describe("computeContractKpis", () => {
  it("lista vazia zera tudo", () => {
    expect(computeContractKpis([], HOJE)).toEqual({
      vigentes: 0,
      receitaMensalCents: 0,
      vencem30: 0,
      vencidos: 0,
      semDocumento: 0,
      rascunhos: 0,
    });
  });

  it("só vigente conta como vigente e entra na receita; rascunho tem contador próprio", () => {
    const k = computeContractKpis(
      [
        c({ price_cents: 10000 }),
        c({ status: "rascunho", price_cents: 99999 }),
        c({ status: "encerrado", price_cents: 99999 }),
        c({ status: "cancelado", price_cents: 99999 }),
      ],
      HOJE,
    );
    expect(k.vigentes).toBe(1);
    expect(k.receitaMensalCents).toBe(10000);
    expect(k.rascunhos).toBe(1);
  });

  it("receita é o equivalente MENSAL: anual de R$ 1.200 entra como R$ 100", () => {
    const k = computeContractKpis(
      [
        c({ price_cents: 14990, billing_cycle: "mensal" }),
        c({ price_cents: 120000, billing_cycle: "anual" }),
        c({ price_cents: 30000, billing_cycle: "trimestral" }),
        c({ price_cents: 60000, billing_cycle: "semestral" }),
      ],
      HOJE,
    );
    expect(k.receitaMensalCents).toBe(14990 + 10000 + 10000 + 10000);
  });

  it("contrato de R$ 0,00 conta como vigente mas não soma receita", () => {
    const k = computeContractKpis([c({ price_cents: 0 })], HOJE);
    expect(k.vigentes).toBe(1);
    expect(k.receitaMensalCents).toBe(0);
  });

  it("vencem em 30 dias: de hoje a +30, inclusive as duas pontas", () => {
    const k = computeContractKpis(
      [
        c({ ends_on: HOJE }),
        c({ ends_on: "2026-11-07" }),
        c({ ends_on: "2026-11-08" }),
        c({ ends_on: null }),
      ],
      HOJE,
    );
    expect(k.vencem30).toBe(2);
    expect(k.vencidos).toBe(0);
  });

  it("vencidos ficam fora de 'vencem em 30' e têm contador próprio", () => {
    const k = computeContractKpis([c({ ends_on: "2026-10-07" }), c({ ends_on: "2020-01-01" })], HOJE);
    expect(k.vencidos).toBe(2);
    expect(k.vencem30).toBe(0);
    // Continuam vigentes (ninguém encerrou), e a receita continua contando.
    expect(k.vigentes).toBe(2);
    expect(k.receitaMensalCents).toBe(20000);
  });

  it("sem documento: só vigentes sem PDF", () => {
    const k = computeContractKpis(
      [
        c({ document_path: null }),
        c({ document_path: "" }),
        c({ document_path: "a/b/c.pdf" }),
        c({ status: "rascunho", document_path: null }),
        c({ status: "encerrado", document_path: null }),
      ],
      HOJE,
    );
    expect(k.semDocumento).toBe(2);
  });

  it("vencimento de encerrado/rascunho não conta", () => {
    const k = computeContractKpis(
      [c({ status: "encerrado", ends_on: "2026-10-10" }), c({ status: "rascunho", ends_on: "2026-10-10" })],
      HOJE,
    );
    expect(k.vencem30).toBe(0);
    expect(k.vencidos).toBe(0);
  });
});
