import { describe, it, expect } from "vitest";
import { calculateAgeYears, classifyBmi } from "@/lib/utils/bmiReference";

describe("calculateAgeYears", () => {
  it("conta o ano cheio após o aniversário", () => {
    expect(calculateAgeYears("2010-03-01", new Date("2026-03-02"))).toBe(16);
  });

  it("não conta o ano ainda antes do aniversário", () => {
    expect(calculateAgeYears("2010-03-01", new Date("2026-02-28"))).toBe(15);
  });

  it("já conta no próprio dia do aniversário", () => {
    expect(calculateAgeYears("2010-03-01", new Date("2026-03-01"))).toBe(16);
  });
});

describe("classifyBmi", () => {
  it("sem bmi ou data de nascimento, não classifica", () => {
    expect(classifyBmi(null, "2010-03-01", "M")).toEqual({
      isUnderweight: false,
      reference: null,
    });
    expect(classifyBmi(20, null, "M")).toEqual({ isUnderweight: false, reference: null });
  });

  it("usa o corte adulto padrão (18.5) a partir de 20 anos", () => {
    const birthDate = "2000-01-01"; // bem acima de 20 anos em qualquer data de execução do teste
    expect(classifyBmi(18.4, birthDate, "M").reference).toBe("adulto");
    expect(classifyBmi(18.4, birthDate, "M").isUnderweight).toBe(true);
    expect(classifyBmi(18.6, birthDate, "M").isUnderweight).toBe(false);
  });

  it("usa a curva da OMS por sexo entre 5 e 19 anos", () => {
    // 12 anos: corte masculino 14.453, feminino 14.391 (WHO_BMI_NEG2SD)
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 12);
    const iso = birthDate.toISOString().slice(0, 10);

    expect(classifyBmi(14.4, iso, "M")).toEqual({ isUnderweight: true, reference: "oms-5-19" });
    expect(classifyBmi(14.5, iso, "M")).toEqual({ isUnderweight: false, reference: "oms-5-19" });
    expect(classifyBmi(14.4, iso, "F")).toEqual({ isUnderweight: false, reference: "oms-5-19" });
  });

  it("sem sexo informado e menor de 20 anos, não classifica", () => {
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 12);
    const iso = birthDate.toISOString().slice(0, 10);
    expect(classifyBmi(14.0, iso, null)).toEqual({ isUnderweight: false, reference: null });
  });

  it("menor de 5 anos não é classificado (fora da curva OMS 5-19)", () => {
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 3);
    const iso = birthDate.toISOString().slice(0, 10);
    expect(classifyBmi(14.0, iso, "M")).toEqual({ isUnderweight: false, reference: null });
  });
});
