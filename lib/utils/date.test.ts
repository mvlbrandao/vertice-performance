import { describe, it, expect, vi, afterEach } from "vitest";
import { hojeISO, somaDias } from "@/lib/utils/date";

describe("hojeISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa a data civil de São Paulo, não UTC", () => {
    // 22h de 15/mar em São Paulo (UTC-3) já é 16/mar em UTC — o bug real que
    // motivou essa função: usar toISOString() aqui devolveria "2026-03-16".
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T01:00:00Z"));
    expect(hojeISO()).toBe("2026-03-15");
  });
});

describe("somaDias", () => {
  it("soma dias dentro do mesmo mês", () => {
    expect(somaDias("2026-03-01", 5)).toBe("2026-03-06");
  });

  it("atravessa a virada de mês", () => {
    expect(somaDias("2026-03-30", 3)).toBe("2026-04-02");
  });

  it("atravessa a virada de ano", () => {
    expect(somaDias("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("subtrai dias com valor negativo", () => {
    expect(somaDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
