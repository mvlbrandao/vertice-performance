import { describe, expect, it } from "vitest";
import {
  contractToFormValues,
  defaultNewContractValues,
  expiryBadge,
  formatCivilBR,
  listCapNotice,
  periodLabel,
  pricePerCycleLabel,
  suggestedEndsOn,
} from "@/lib/platform/contractView";
import { classifyExpiry } from "@/lib/platform/contractRules";
import { createContractSchema } from "@/lib/platform/contractSchema";

const HOJE = "2026-10-08";
const badge = (ends_on: string | null) => expiryBadge(classifyExpiry({ status: "vigente", ends_on }, HOJE));

describe("formatCivilBR e periodLabel", () => {
  it("formata data civil sem passar por fuso", () => {
    expect(formatCivilBR("2026-10-08")).toBe("08/10/2026");
    expect(formatCivilBR("2026-01-01")).toBe("01/01/2026");
  });

  it("vazio vira travessão e texto estranho passa como veio", () => {
    expect(formatCivilBR(null)).toBe("—");
    expect(formatCivilBR(undefined)).toBe("—");
    expect(formatCivilBR("")).toBe("—");
    expect(formatCivilBR("amanhã")).toBe("amanhã");
  });

  it("período com e sem fim", () => {
    expect(periodLabel("2026-10-01", "2026-10-31")).toBe("01/10/2026 a 31/10/2026");
    expect(periodLabel("2026-10-01", null)).toBe("desde 01/10/2026 (prazo indeterminado)");
  });
});

describe("pricePerCycleLabel", () => {
  it("diz o valor do ciclo, não o mensal", () => {
    expect(pricePerCycleLabel(120000, "anual")).toContain("por ano");
    expect(pricePerCycleLabel(120000, "anual")).toContain("1.200,00");
    expect(pricePerCycleLabel(14990, "mensal")).toContain("por mês");
    expect(pricePerCycleLabel(0, "trimestral")).toContain("0,00");
  });
});

describe("expiryBadge", () => {
  it("vencido: quantos dias, no singular e no plural", () => {
    expect(badge("2026-10-07")).toEqual({ label: "Vencido há 1 dia", tone: "clay" });
    expect(badge("2026-09-28")).toEqual({ label: "Vencido há 10 dias", tone: "clay" });
  });

  it("hoje, amanhã e até 30 dias: vermelho", () => {
    expect(badge("2026-10-08")).toEqual({ label: "Vence hoje", tone: "clay" });
    expect(badge("2026-10-09")).toEqual({ label: "Vence amanhã", tone: "clay" });
    expect(badge("2026-11-07")).toEqual({ label: "Vence em 30 dias", tone: "clay" });
  });

  it("31 a 90 dias: amarelo; depois disso, sem selo", () => {
    expect(badge("2026-11-08")).toEqual({ label: "Vence em 31 dias", tone: "amber" });
    expect(badge("2027-01-06")).toEqual({ label: "Vence em 90 dias", tone: "amber" });
    expect(badge("2027-01-07")).toBeNull();
  });

  it("prazo indeterminado tem selo neutro", () => {
    expect(badge(null)).toEqual({ label: "Prazo indeterminado", tone: "dark" });
  });

  it("contrato que não é vigente nunca ganha selo de prazo", () => {
    for (const status of ["rascunho", "encerrado", "cancelado"] as const) {
      expect(expiryBadge(classifyExpiry({ status, ends_on: "2020-01-01" }, HOJE))).toBeNull();
    }
  });
});

describe("listCapNotice", () => {
  it("só avisa quando cortou", () => {
    expect(listCapNotice(200, 200)).toBeNull();
    expect(listCapNotice(50, 10)).toBeNull();
    expect(listCapNotice(200, 201)).toContain("200 de 201");
  });
});

describe("suggestedEndsOn", () => {
  it("início + ciclo - 1 dia", () => {
    expect(suggestedEndsOn("2026-10-01", "mensal")).toBe("2026-10-31");
    expect(suggestedEndsOn("2026-10-08", "mensal")).toBe("2026-11-07");
    expect(suggestedEndsOn("2026-01-01", "anual")).toBe("2026-12-31");
    expect(suggestedEndsOn("2026-10-08", "trimestral")).toBe("2027-01-07");
    expect(suggestedEndsOn("2026-10-08", "semestral")).toBe("2027-04-07");
  });

  it("fim de mês: 31/01 mensal = 27/02 (28/02 menos um dia)", () => {
    expect(suggestedEndsOn("2026-01-31", "mensal")).toBe("2026-02-27");
  });

  it("data pela metade ou inválida não gera erro nem sugestão", () => {
    expect(suggestedEndsOn("", "mensal")).toBeNull();
    expect(suggestedEndsOn("2026-02-30", "mensal")).toBeNull();
    expect(suggestedEndsOn("2026-1", "anual")).toBeNull();
  });
});

describe("valores iniciais do formulário", () => {
  const row = {
    plan_name: "Plano Clube",
    price_cents: 149990,
    max_athletes: 80,
    billing_cycle: "anual" as const,
    starts_on: "2026-01-01",
    ends_on: "2026-12-31",
    auto_renew: false,
    signed_on: "2025-12-20",
    signer_name: "Maria",
    signer_role: "Presidente",
    terms_version: "v3",
    notes: "obs",
  };

  it("contrato existente vira texto de formulário", () => {
    expect(contractToFormValues(row)).toEqual({
      planName: "Plano Clube",
      priceReais: "1499,90",
      maxAthletes: "80",
      billingCycle: "anual",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      autoRenew: "false",
      signedOn: "2025-12-20",
      signerName: "Maria",
      signerRole: "Presidente",
      termsVersion: "v3",
      notes: "obs",
    });
  });

  it("campos vazios viram texto vazio, nunca 'null'", () => {
    const v = contractToFormValues({
      ...row,
      max_athletes: null,
      ends_on: null,
      signed_on: null,
      signer_name: null,
      signer_role: null,
      terms_version: null,
      notes: null,
      price_cents: 0,
    });
    expect(v).toMatchObject({ maxAthletes: "", endsOn: "", signedOn: "", signerName: "", signerRole: "", termsVersion: "", notes: "", priceReais: "0,00" });
  });

  it("o texto do formulário volta pelo esquema sem perder nada (ida e volta)", () => {
    const parsed = createContractSchema.safeParse({
      clubId: "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f",
      ...contractToFormValues(row),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.fields).toMatchObject({
      price_cents: 149990,
      max_athletes: 80,
      billing_cycle: "anual",
      ends_on: "2026-12-31",
      auto_renew: false,
    });
  });

  it("contrato novo parte do plano padrão, mensal, começando hoje", () => {
    const v = defaultNewContractValues({ planName: "Vértice Clube", priceCents: 0 }, HOJE);
    expect(v).toMatchObject({
      planName: "Vértice Clube",
      priceReais: "0,00",
      maxAthletes: "",
      billingCycle: "mensal",
      startsOn: HOJE,
      endsOn: "2026-11-07",
      autoRenew: "true",
    });
    // O que o formulário oferece de partida precisa passar pela validação do servidor.
    const parsed = createContractSchema.safeParse({ clubId: "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f", ...v });
    expect(parsed.success).toBe(true);
  });
});
