import { describe, expect, it } from "vitest";
import { MAX_CENTS, centsToInput, formatCents, parseReaisToCents } from "@/lib/utils/money";

describe("parseReaisToCents", () => {
  it("aceita vírgula decimal", () => {
    expect(parseReaisToCents("149,90")).toBe(14990);
    expect(parseReaisToCents("149,9")).toBe(14990);
    expect(parseReaisToCents("0,05")).toBe(5);
    expect(parseReaisToCents("19,90")).toBe(1990); // 19,90 * 100 em float dá 1989.99...
  });

  it("aceita ponto decimal com 1 ou 2 casas (o caso que a versão antiga errava 100x)", () => {
    expect(parseReaisToCents("149.90")).toBe(14990);
    expect(parseReaisToCents("149.9")).toBe(14990);
  });

  it("separa milhar de decimal pelo contexto", () => {
    expect(parseReaisToCents("1.499,90")).toBe(149990);
    expect(parseReaisToCents("1.499")).toBe(149900);
    expect(parseReaisToCents("12.345.678")).toBe(null); // R$ 12 milhões: acima do teto
    expect(parseReaisToCents("1.499.000")).toBe(null); // acima do teto
  });

  it("aceita inteiro, R$ e espaços", () => {
    expect(parseReaisToCents("150")).toBe(15000);
    expect(parseReaisToCents("R$ 149,90")).toBe(14990);
    expect(parseReaisToCents("  R$149,90 ")).toBe(14990);
    expect(parseReaisToCents("0")).toBe(0);
  });

  it("recusa o que não consegue interpretar sem adivinhar", () => {
    expect(parseReaisToCents("")).toBe(null);
    expect(parseReaisToCents("   ")).toBe(null);
    expect(parseReaisToCents("abc")).toBe(null);
    expect(parseReaisToCents("-10")).toBe(null);
    expect(parseReaisToCents("10,5,5")).toBe(null);
    expect(parseReaisToCents("10,999")).toBe(null);
    expect(parseReaisToCents("1.4,99")).toBe(null); // ponto fora do padrão de milhar
    expect(parseReaisToCents("149.999")).toBe(14999900); // 3 casas = milhar, não decimal
    expect(parseReaisToCents("1..5")).toBe(null);
    expect(parseReaisToCents(",50")).toBe(null);
  });

  it("recusa valor acima do teto de sanidade", () => {
    expect(parseReaisToCents("1000000")).toBe(MAX_CENTS);
    expect(parseReaisToCents("1000000,01")).toBe(null);
    expect(parseReaisToCents("99999999999999999999")).toBe(null);
  });

  it("não perde centavo por ponto flutuante", () => {
    for (let c = 0; c <= 3000; c += 7) {
      const texto = (c / 100).toFixed(2).replace(".", ",");
      expect(parseReaisToCents(texto)).toBe(c);
    }
  });
});

describe("formatCents / centsToInput", () => {
  it("formata em reais pt-BR", () => {
    expect(formatCents(149990).replace(/\s/g, " ")).toBe("R$ 1.499,90");
    expect(formatCents(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });

  it("devolve o texto de campo e volta ao mesmo valor", () => {
    expect(centsToInput(14990)).toBe("149,90");
    expect(centsToInput(5)).toBe("0,05");
    expect(parseReaisToCents(centsToInput(123456))).toBe(123456);
  });
});
