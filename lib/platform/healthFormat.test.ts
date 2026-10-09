import { describe, expect, it } from "vitest";
import { formatAgo, formatCount, formatDayShort, formatDuration, formatMs, formatVital } from "./healthFormat";

describe("formatMs", () => {
  it("ms abaixo de 1 s, segundos com vírgula acima", () => {
    expect(formatMs(0)).toBe("0 ms");
    expect(formatMs(240.4)).toBe("240 ms");
    expect(formatMs(999.4)).toBe("999 ms");
    // Nunca "1.000 ms": ao arredondar para 1000 passa a segundos.
    expect(formatMs(999.6)).toBe("1,0 s");
    expect(formatMs(1_000)).toBe("1,0 s");
    expect(formatMs(2_431)).toBe("2,4 s");
  });

  it("ausente ou inválido vira travessão", () => {
    expect(formatMs(null)).toBe("—");
    expect(formatMs(undefined)).toBe("—");
    expect(formatMs(Number.NaN)).toBe("—");
  });
});

describe("formatVital", () => {
  it("CLS sem unidade e com duas casas; o resto em tempo", () => {
    expect(formatVital("CLS", 0.1234)).toBe("0,12");
    expect(formatVital("LCP", 2_431)).toBe("2,4 s");
    expect(formatVital("INP", 180)).toBe("180 ms");
    expect(formatVital("TTFB", Number.NaN)).toBe("—");
  });
});

describe("formatAgo", () => {
  const agora = Date.parse("2026-10-08T12:00:00Z");
  it("escala de segundos a dias", () => {
    expect(formatAgo("2026-10-08T11:59:30Z", agora)).toBe("agora há pouco");
    expect(formatAgo("2026-10-08T11:55:00Z", agora)).toBe("há 5 min");
    expect(formatAgo("2026-10-08T09:00:00Z", agora)).toBe("há 3 h");
    expect(formatAgo("2026-10-05T12:00:00Z", agora)).toBe("há 3 dias");
  });

  it("futuro, vazio e lixo não inventam nada", () => {
    expect(formatAgo("2026-10-09T12:00:00Z", agora)).toBe("agora há pouco");
    expect(formatAgo(null, agora)).toBe("—");
    expect(formatAgo("lixo", agora)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("ms, segundos e minutos", () => {
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(12_000)).toBe("12 s");
    expect(formatDuration(75_000)).toBe("1 min 15 s");
    expect(formatDuration(120_000)).toBe("2 min");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("formatCount / formatDayShort", () => {
  it("separador de milhar brasileiro", () => {
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(Number.NaN)).toBe("0");
  });

  it("dia curto", () => {
    expect(formatDayShort("2026-10-08")).toBe("08/10");
    expect(formatDayShort("lixo")).toBe("lixo");
  });
});
