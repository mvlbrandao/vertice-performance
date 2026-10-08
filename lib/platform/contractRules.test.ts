import { describe, expect, it } from "vitest";
import {
  canTransition,
  classifyExpiry,
  diffDays,
  monthlyEquivalentCents,
} from "@/lib/platform/contractRules";

describe("monthlyEquivalentCents", () => {
  it("mensal devolve o próprio valor", () => {
    expect(monthlyEquivalentCents(14990, "mensal")).toBe(14990);
  });

  it("anual divide por 12", () => {
    expect(monthlyEquivalentCents(120000, "anual")).toBe(10000);
  });

  it("trimestral e semestral dividem por 3 e 6", () => {
    expect(monthlyEquivalentCents(29970, "trimestral")).toBe(9990);
    expect(monthlyEquivalentCents(60000, "semestral")).toBe(10000);
  });

  it("arredonda para centavo inteiro", () => {
    // 100000 / 12 = 8333,33...
    expect(monthlyEquivalentCents(100000, "anual")).toBe(8333);
    expect(Number.isInteger(monthlyEquivalentCents(99999, "anual"))).toBe(true);
  });
});

describe("diffDays", () => {
  it("conta dias corridos entre datas civis", () => {
    expect(diffDays("2026-10-08", "2026-10-09")).toBe(1);
    expect(diffDays("2026-10-08", "2026-10-08")).toBe(0);
    expect(diffDays("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("atravessa virada de mês e de ano", () => {
    expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(diffDays("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("não é afetada por horário de verão (aritmética em UTC)", () => {
    expect(diffDays("2026-03-01", "2026-04-01")).toBe(31);
    expect(diffDays("2026-10-01", "2026-11-01")).toBe(31);
  });
});

describe("classifyExpiry", () => {
  const hoje = "2026-10-08";
  const vigente = (ends_on: string | null) => ({ status: "vigente" as const, ends_on });

  it("prazo indeterminado não tem dias", () => {
    expect(classifyExpiry(vigente(null), hoje)).toEqual({ state: "indeterminado", days: null });
  });

  it("vence hoje conta como vence_30, não como vencido", () => {
    expect(classifyExpiry(vigente("2026-10-08"), hoje)).toEqual({ state: "vence_30", days: 0 });
  });

  it("ontem já é vencido", () => {
    expect(classifyExpiry(vigente("2026-10-07"), hoje)).toEqual({ state: "vencido", days: -1 });
  });

  it("fronteiras 30, 60 e 90 dias", () => {
    expect(classifyExpiry(vigente("2026-11-07"), hoje).state).toBe("vence_30"); // +30
    expect(classifyExpiry(vigente("2026-11-08"), hoje).state).toBe("vence_60"); // +31
    expect(classifyExpiry(vigente("2026-12-07"), hoje).state).toBe("vence_60"); // +60
    expect(classifyExpiry(vigente("2026-12-08"), hoje).state).toBe("vence_90"); // +61
    expect(classifyExpiry(vigente("2027-01-06"), hoje).state).toBe("vence_90"); // +90
    expect(classifyExpiry(vigente("2027-01-07"), hoje).state).toBe("em_dia"); // +91
  });

  it("só contrato vigente é avaliado", () => {
    for (const status of ["rascunho", "encerrado", "cancelado"] as const) {
      expect(classifyExpiry({ status, ends_on: "2020-01-01" }, hoje)).toEqual({
        state: "em_dia",
        days: null,
      });
    }
  });
});

describe("canTransition", () => {
  it("rascunho ativa ou cancela", () => {
    expect(canTransition("rascunho", "vigente")).toBe(true);
    expect(canTransition("rascunho", "cancelado")).toBe(true);
    expect(canTransition("rascunho", "encerrado")).toBe(false);
  });

  it("vigente encerra ou cancela, mas não volta a rascunho", () => {
    expect(canTransition("vigente", "encerrado")).toBe(true);
    expect(canTransition("vigente", "cancelado")).toBe(true);
    expect(canTransition("vigente", "rascunho")).toBe(false);
  });

  it("estados finais não saem do lugar", () => {
    for (const to of ["rascunho", "vigente", "encerrado", "cancelado"] as const) {
      expect(canTransition("encerrado", to)).toBe(false);
      expect(canTransition("cancelado", to)).toBe(false);
    }
  });
});
