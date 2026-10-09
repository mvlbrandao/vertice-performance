import { describe, expect, it } from "vitest";
import {
  addMonthsCivil,
  canChangeDocument,
  canRenew,
  canTransition,
  classifyExpiry,
  compareWithLicense,
  contractCode,
  diffDays,
  editableFields,
  isEditable,
  isValidCivilDate,
  licenseWithoutActiveContract,
  monthlyEquivalentCents,
  nextPeriodAfter,
  replacedReason,
  wholeMonthsOfPeriod,
  type ContractForComparison,
  type LicenseSnapshot,
} from "@/lib/platform/contractRules";
import type { ContractStatus } from "@/lib/types/database";

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

describe("isValidCivilDate", () => {
  it("aceita datas que existem, inclusive 29/02 de ano bissexto", () => {
    expect(isValidCivilDate("2026-10-08")).toBe(true);
    expect(isValidCivilDate("2028-02-29")).toBe(true);
    expect(isValidCivilDate("2026-12-31")).toBe(true);
  });

  it("recusa dia que não existe no mês, mesmo com formato certo", () => {
    expect(isValidCivilDate("2026-02-29")).toBe(false);
    expect(isValidCivilDate("2026-02-30")).toBe(false);
    expect(isValidCivilDate("2026-04-31")).toBe(false);
    expect(isValidCivilDate("2026-13-01")).toBe(false);
    expect(isValidCivilDate("2026-00-10")).toBe(false);
    expect(isValidCivilDate("2026-10-00")).toBe(false);
  });

  it("recusa formato fora de AAAA-MM-DD e tipos que não são texto", () => {
    expect(isValidCivilDate("2026-1-1")).toBe(false);
    expect(isValidCivilDate("08/10/2026")).toBe(false);
    expect(isValidCivilDate("2026-10-08T00:00:00Z")).toBe(false);
    expect(isValidCivilDate(" 2026-10-08")).toBe(false);
    expect(isValidCivilDate("")).toBe(false);
    expect(isValidCivilDate(null)).toBe(false);
    expect(isValidCivilDate(20261008)).toBe(false);
  });

  it("recusa ano absurdo (erro de digitação)", () => {
    expect(isValidCivilDate("0026-10-08")).toBe(false);
    expect(isValidCivilDate("1899-12-31")).toBe(false);
    expect(isValidCivilDate("1900-01-01")).toBe(true);
    expect(isValidCivilDate("3000-01-01")).toBe(false);
    expect(isValidCivilDate("2999-12-31")).toBe(true);
  });
});

describe("addMonthsCivil", () => {
  it("soma meses simples", () => {
    expect(addMonthsCivil("2026-10-08", 1)).toBe("2026-11-08");
    expect(addMonthsCivil("2026-10-08", 12)).toBe("2027-10-08");
    expect(addMonthsCivil("2026-10-08", 0)).toBe("2026-10-08");
  });

  it("31/01 + 1 mês = 28/02 (ano comum) e 29/02 (bissexto), nunca 03/03", () => {
    expect(addMonthsCivil("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsCivil("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("ajusta ao último dia em meses de 30 dias", () => {
    expect(addMonthsCivil("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonthsCivil("2026-08-31", 1)).toBe("2026-09-30");
    expect(addMonthsCivil("2026-05-31", 6)).toBe("2026-11-30");
  });

  it("29/02 de ano bissexto + 12 meses cai em 28/02 do ano comum; +48 volta ao 29/02", () => {
    expect(addMonthsCivil("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonthsCivil("2028-02-29", 48)).toBe("2032-02-29");
  });

  it("atravessa virada de ano", () => {
    expect(addMonthsCivil("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsCivil("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsCivil("2026-12-31", 14)).toBe("2028-02-29");
  });

  it("aceita meses negativos", () => {
    expect(addMonthsCivil("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsCivil("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonthsCivil("2026-01-15", -13)).toBe("2024-12-15");
  });

  it("recusa data inválida e quantidade fracionada", () => {
    expect(() => addMonthsCivil("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addMonthsCivil("lixo", 1)).toThrow(RangeError);
    expect(() => addMonthsCivil("2026-10-08", 1.5)).toThrow(RangeError);
    expect(() => addMonthsCivil("2026-10-08", Number.NaN)).toThrow(RangeError);
  });
});

describe("wholeMonthsOfPeriod", () => {
  it("reconhece períodos de meses inteiros", () => {
    expect(wholeMonthsOfPeriod("2026-01-01", "2026-01-31")).toBe(1);
    expect(wholeMonthsOfPeriod("2026-01-01", "2026-12-31")).toBe(12);
    expect(wholeMonthsOfPeriod("2026-02-01", "2026-02-28")).toBe(1);
    expect(wholeMonthsOfPeriod("2026-10-08", "2027-01-07")).toBe(3);
    expect(wholeMonthsOfPeriod("2026-01-15", "2026-03-14")).toBe(2);
  });

  it("devolve null quando não é um número exato de meses", () => {
    expect(wholeMonthsOfPeriod("2026-10-08", "2026-12-15")).toBeNull();
    expect(wholeMonthsOfPeriod("2026-10-08", "2026-10-08")).toBeNull();
    expect(wholeMonthsOfPeriod("2026-01-01", "2026-01-30")).toBeNull();
  });

  it("início em fim de mês fecha na mesma regra que gera o fim", () => {
    // 31/01 + 1 mês = 28/02; fim = 27/02.
    expect(wholeMonthsOfPeriod("2026-01-31", "2026-02-27")).toBe(1);
  });
});

describe("nextPeriodAfter", () => {
  it("renova no dia seguinte ao fim, mantendo o ciclo e a duração (mensal)", () => {
    expect(
      nextPeriodAfter({ starts_on: "2026-10-01", ends_on: "2026-10-31", billing_cycle: "mensal" }),
    ).toEqual({ starts_on: "2026-11-01", ends_on: "2026-11-30", billing_cycle: "mensal", months: 1 });
  });

  it("anual renova por 12 meses, sem buraco nem sobreposição", () => {
    expect(
      nextPeriodAfter({ starts_on: "2026-01-01", ends_on: "2026-12-31", billing_cycle: "anual" }),
    ).toEqual({ starts_on: "2027-01-01", ends_on: "2027-12-31", billing_cycle: "anual", months: 12 });
  });

  it("contrato de 12 meses cobrado por mês renova por 12 meses, não por 1", () => {
    const next = nextPeriodAfter({ starts_on: "2026-03-15", ends_on: "2027-03-14", billing_cycle: "mensal" });
    expect(next).toEqual({ starts_on: "2027-03-15", ends_on: "2028-03-14", billing_cycle: "mensal", months: 12 });
  });

  it("virada de ano e fevereiro bissexto", () => {
    expect(
      nextPeriodAfter({ starts_on: "2027-02-01", ends_on: "2027-02-28", billing_cycle: "mensal" }),
    ).toMatchObject({ starts_on: "2027-03-01", ends_on: "2027-03-31" });
    expect(
      nextPeriodAfter({ starts_on: "2027-12-01", ends_on: "2028-01-31", billing_cycle: "mensal" }),
    ).toMatchObject({ starts_on: "2028-02-01", ends_on: "2028-03-31", months: 2 });
    expect(
      nextPeriodAfter({ starts_on: "2028-02-01", ends_on: "2028-02-29", billing_cycle: "mensal" }),
    ).toMatchObject({ starts_on: "2028-03-01", ends_on: "2028-03-31" });
  });

  it("período que não é de meses inteiros cai na duração de um ciclo", () => {
    expect(
      nextPeriodAfter({ starts_on: "2026-10-08", ends_on: "2026-12-15", billing_cycle: "trimestral" }),
    ).toEqual({ starts_on: "2026-12-16", ends_on: "2027-03-15", billing_cycle: "trimestral", months: 3 });
  });

  it("prazo indeterminado ou data inválida não tem renovação", () => {
    expect(nextPeriodAfter({ starts_on: "2026-01-01", ends_on: null, billing_cycle: "mensal" })).toBeNull();
    expect(
      nextPeriodAfter({ starts_on: "2026-01-01", ends_on: "2026-02-30", billing_cycle: "mensal" }),
    ).toBeNull();
  });

  it("o fim nunca é anterior ao início e o início é sempre o dia seguinte", () => {
    for (const cycle of ["mensal", "trimestral", "semestral", "anual"] as const) {
      const next = nextPeriodAfter({ starts_on: "2026-01-31", ends_on: "2026-05-30", billing_cycle: cycle });
      expect(next).not.toBeNull();
      expect(next!.starts_on).toBe("2026-05-31");
      expect(diffDays(next!.starts_on, next!.ends_on)).toBeGreaterThan(0);
    }
  });
});

describe("contractCode e replacedReason", () => {
  it("CT-n sem zeros à esquerda", () => {
    expect(contractCode(1)).toBe("CT-1");
    expect(contractCode(128)).toBe("CT-128");
  });

  it("o motivo da substituição cita o contrato novo", () => {
    expect(replacedReason(2)).toBe("Substituído pelo CT-2");
  });
});

describe("edição por status", () => {
  it("rascunho e vigente editam tudo; encerrado e cancelado, nada", () => {
    expect(editableFields("rascunho")).toContain("price_cents");
    expect(editableFields("vigente")).toContain("price_cents");
    expect(editableFields("encerrado")).toEqual([]);
    expect(editableFields("cancelado")).toEqual([]);
  });

  it("nunca deixa editar clube nem situação por aqui", () => {
    const fields = editableFields("rascunho") as readonly string[];
    expect(fields).not.toContain("club_id");
    expect(fields).not.toContain("status");
    expect(fields).not.toContain("document_path");
    expect(fields).not.toContain("closed_reason");
  });

  it("isEditable e canChangeDocument seguem a mesma regra", () => {
    const status: ContractStatus[] = ["rascunho", "vigente", "encerrado", "cancelado"];
    expect(status.map(isEditable)).toEqual([true, true, false, false]);
    expect(status.map(canChangeDocument)).toEqual([true, true, false, false]);
  });
});

describe("canRenew", () => {
  it("vigente e encerrado com data de fim podem renovar", () => {
    expect(canRenew({ status: "vigente", ends_on: "2026-12-31" })).toBe(true);
    expect(canRenew({ status: "encerrado", ends_on: "2026-12-31" })).toBe(true);
  });

  it("rascunho, cancelado e prazo indeterminado não", () => {
    expect(canRenew({ status: "rascunho", ends_on: "2026-12-31" })).toBe(false);
    expect(canRenew({ status: "cancelado", ends_on: "2026-12-31" })).toBe(false);
    expect(canRenew({ status: "vigente", ends_on: null })).toBe(false);
  });
});

const licenca: LicenseSnapshot = {
  status: "ativo",
  allowed: true,
  courtesyActive: false,
  courtesyUntil: null,
  priceCents: 14990,
  maxAthletes: 50,
  defaultMaxAthletes: 50,
  isDemo: false,
};

const contrato: ContractForComparison = {
  status: "vigente",
  price_cents: 14990,
  max_athletes: null,
  billing_cycle: "mensal",
};

const codes = (c: ContractForComparison | null, l: LicenseSnapshot) =>
  compareWithLicense(c, l).map((d) => d.code);

describe("compareWithLicense", () => {
  it("contrato e licença iguais não divergem", () => {
    expect(compareWithLicense(contrato, licenca)).toEqual([]);
  });

  it("preço: compara o equivalente MENSAL com a mensalidade da licença", () => {
    expect(codes({ ...contrato, price_cents: 17990 }, licenca)).toEqual(["preco"]);
    // anual de R$ 1.798,80 = R$ 149,90 por mês: igual à licença.
    expect(codes({ ...contrato, price_cents: 179880, billing_cycle: "anual" }, licenca)).toEqual([]);
    // anual de R$ 1.200 = R$ 100 por mês: diverge.
    expect(codes({ ...contrato, price_cents: 120000, billing_cycle: "anual" }, licenca)).toEqual(["preco"]);
  });

  it("a mensagem de preço traz os dois valores e o valor do ciclo quando não é mensal", () => {
    const [d] = compareWithLicense({ ...contrato, price_cents: 120000, billing_cycle: "anual" }, licenca);
    expect(d.severity).toBe("alerta");
    expect(d.message).toContain("100,00");
    expect(d.message).toContain("149,90");
    expect(d.message).toContain("1.200,00");
    expect(d.message).toContain("por ano");
  });

  it("cota própria diferente da licença diverge; vazia compara com a cota padrão", () => {
    expect(codes({ ...contrato, max_athletes: 80 }, licenca)).toEqual(["cota"]);
    expect(codes({ ...contrato, max_athletes: 50 }, licenca)).toEqual([]);
    // Contrato sem cota própria vale a cota padrão; a licença deu 80 ao clube: diverge.
    expect(codes(contrato, { ...licenca, maxAthletes: 80 })).toEqual(["cota"]);
    // Licença com cota própria igual à padrão do contrato vazio: não diverge.
    expect(codes(contrato, { ...licenca, maxAthletes: 50, defaultMaxAthletes: 50 })).toEqual([]);
  });

  it("contrato vigente em clube bloqueado ou cancelado: licença sem acesso", () => {
    const bloqueado = compareWithLicense(contrato, { ...licenca, status: "bloqueado", allowed: false });
    expect(bloqueado.map((d) => d.code)).toEqual(["licenca_sem_acesso"]);
    expect(bloqueado[0].message).toContain("bloqueado");
    const cancelado = compareWithLicense(contrato, { ...licenca, status: "cancelado", allowed: false });
    expect(cancelado[0].message).toContain("cancelado");
  });

  it("contrato vigente em teste vencido: licença sem acesso, com o motivo certo", () => {
    const [d] = compareWithLicense(contrato, { ...licenca, status: "trial", allowed: false });
    expect(d.code).toBe("licenca_sem_acesso");
    expect(d.message).toContain("teste");
  });

  it("contrato vigente em teste ainda válido: clube em teste", () => {
    expect(codes(contrato, { ...licenca, status: "trial", allowed: true })).toEqual(["clube_em_teste"]);
  });

  it("cortesia ativa com contrato que cobra: só um aviso, com a data", () => {
    const [d] = compareWithLicense(contrato, {
      ...licenca,
      status: "trial",
      allowed: true,
      courtesyActive: true,
      courtesyUntil: "2026-12-31",
    });
    expect(d.code).toBe("cortesia");
    expect(d.severity).toBe("aviso");
    expect(d.message).toContain("31/12/2026");
  });

  it("cortesia com contrato de R$ 0,00 não avisa nada", () => {
    expect(
      codes(
        { ...contrato, price_cents: 0 },
        { ...licenca, priceCents: 0, courtesyActive: true, courtesyUntil: "2026-12-31" },
      ),
    ).toEqual([]);
  });

  it("clube atrasado com contrato vigente não diverge: a licença ainda deixa entrar", () => {
    expect(codes(contrato, { ...licenca, status: "atrasado" })).toEqual([]);
  });

  it("rascunho só compara preço e cota; encerrado e cancelado não comparam nada", () => {
    const rascunho: ContractForComparison = { ...contrato, status: "rascunho", price_cents: 1 };
    expect(codes(rascunho, { ...licenca, status: "bloqueado", allowed: false })).toEqual(["preco"]);
    for (const status of ["encerrado", "cancelado"] as const) {
      expect(codes({ ...contrato, status, price_cents: 1 }, { ...licenca, status: "bloqueado", allowed: false })).toEqual([]);
    }
  });

  it("acumula divergências na ordem preço, cota, acesso", () => {
    expect(
      codes(
        { ...contrato, price_cents: 1000, max_athletes: 10 },
        { ...licenca, status: "bloqueado", allowed: false },
      ),
    ).toEqual(["preco", "cota", "licenca_sem_acesso"]);
  });

  it("sem contrato vigente: só alerta se a licença é paga", () => {
    expect(codes(null, licenca)).toEqual(["sem_contrato_vigente"]);
    expect(codes(null, { ...licenca, status: "atrasado" })).toEqual(["sem_contrato_vigente"]);
    expect(compareWithLicense(null, { ...licenca, status: "atrasado" })[0].message).toContain("atraso");
    for (const status of ["trial", "bloqueado", "cancelado"] as const) {
      expect(codes(null, { ...licenca, status })).toEqual([]);
    }
  });

  it("clube de demonstração nunca precisa de contrato", () => {
    expect(codes(null, { ...licenca, isDemo: true })).toEqual([]);
    expect(licenseWithoutActiveContract({ ...licenca, isDemo: true })).toBeNull();
  });
});
