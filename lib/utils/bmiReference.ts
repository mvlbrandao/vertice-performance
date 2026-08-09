import type { AthleteSex } from "@/lib/types/database";

// Referência oficial da OMS (Growth Reference 2007, 5–19 anos) — coluna "-2SD"
// de bmi-boys-z-who-2007-exp.xlsx / bmi-girls-z-who-2007-exp.xlsx, por ano de
// idade. IMC abaixo desse valor = "magreza" (thinness) pela definição da OMS.
// Fonte: https://www.who.int/tools/growth-reference-data-for-5to19-years
const WHO_BMI_NEG2SD: Record<AthleteSex, Record<number, number>> = {
  M: {
    5: 13.031,
    6: 13.04,
    7: 13.148,
    8: 13.302,
    9: 13.491,
    10: 13.735,
    11: 14.056,
    12: 14.453,
    13: 14.935,
    14: 15.475,
    15: 16.011,
    16: 16.505,
    17: 16.933,
    18: 17.284,
    19: 17.554,
  },
  F: {
    5: 12.748,
    6: 12.7,
    7: 12.735,
    8: 12.884,
    9: 13.14,
    10: 13.47,
    11: 13.885,
    12: 14.391,
    13: 14.936,
    14: 15.448,
    15: 15.871,
    16: 16.172,
    17: 16.354,
    18: 16.448,
    19: 16.497,
  },
};

const ADULT_UNDERWEIGHT_CUTOFF = 18.5;

export function calculateAgeYears(birthDate: string, atDate = new Date()): number {
  const birth = new Date(birthDate);
  let age = atDate.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    atDate.getMonth() > birth.getMonth() ||
    (atDate.getMonth() === birth.getMonth() && atDate.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export interface BmiClassification {
  isUnderweight: boolean;
  reference: "oms-5-19" | "adulto" | null;
}

/**
 * Classifica o IMC considerando idade e sexo. Usa a referência da OMS
 * para 5–19 anos (curvas diferentes por sexo) e o corte adulto padrão
 * (IMC < 18.5) para 20+. Sem idade ou sexo suficientes, não classifica.
 */
export function classifyBmi(
  bmi: number | null,
  birthDate: string | null,
  sex: AthleteSex | null,
): BmiClassification {
  if (!bmi || !birthDate) return { isUnderweight: false, reference: null };

  const age = calculateAgeYears(birthDate);

  if (age >= 20) {
    return { isUnderweight: bmi < ADULT_UNDERWEIGHT_CUTOFF, reference: "adulto" };
  }

  if (age >= 5 && sex) {
    const clampedAge = Math.min(19, Math.max(5, age));
    const cutoff = WHO_BMI_NEG2SD[sex][clampedAge];
    return { isUnderweight: bmi < cutoff, reference: "oms-5-19" };
  }

  return { isUnderweight: false, reference: null };
}
