import { describe, expect, it } from "vitest";
import {
  buildVitalReport,
  createVitalsDeduper,
  isVitalMetric,
  parseSampleRate,
  routeForMetric,
  shouldSample,
} from "./vitalsShared";

describe("parseSampleRate", () => {
  it("ausente, vazia ou ilegível = 1 (mede todo mundo)", () => {
    expect(parseSampleRate(undefined)).toBe(1);
    expect(parseSampleRate(null)).toBe(1);
    expect(parseSampleRate("")).toBe(1);
    expect(parseSampleRate("   ")).toBe(1);
    expect(parseSampleRate("abc")).toBe(1);
    expect(parseSampleRate("NaN")).toBe(1);
  });

  it("lê número entre 0 e 1, inclusive com vírgula decimal", () => {
    expect(parseSampleRate("0.25")).toBe(0.25);
    expect(parseSampleRate("0,5")).toBe(0.5);
    expect(parseSampleRate("0")).toBe(0);
    expect(parseSampleRate(" 1 ")).toBe(1);
  });

  it("recorta o que sai da faixa", () => {
    expect(parseSampleRate("1.5")).toBe(1);
    expect(parseSampleRate("-1")).toBe(0);
  });
});

describe("shouldSample", () => {
  it("taxa 1 sempre mede e taxa 0 nunca mede, sem sortear", () => {
    const naoChamar = () => {
      throw new Error("não devia sortear");
    };
    expect(shouldSample(1, naoChamar)).toBe(true);
    expect(shouldSample(0, naoChamar)).toBe(false);
  });

  it("entre 0 e 1, compara com o sorteio", () => {
    expect(shouldSample(0.3, () => 0.29)).toBe(true);
    expect(shouldSample(0.3, () => 0.3)).toBe(false);
    expect(shouldSample(0.3, () => 0.9)).toBe(false);
  });
});

describe("isVitalMetric", () => {
  it("aceita só as cinco métricas", () => {
    for (const m of ["LCP", "INP", "CLS", "TTFB", "FCP"]) expect(isVitalMetric(m)).toBe(true);
    for (const m of ["FID", "Next.js-hydration", "lcp", "", null, 3]) expect(isVitalMetric(m)).toBe(false);
  });
});

describe("buildVitalReport", () => {
  const metric = { name: "LCP", value: 1234.5678, rating: "good", navigationType: "navigate" };

  it("monta o corpo com valor arredondado e rota sem query string", () => {
    expect(buildVitalReport(metric, "/athletes/42/dados?token=abc#x")).toEqual({
      name: "LCP",
      value: 1234.57,
      rating: "good",
      route: "/athletes/42/dados",
      navigationType: "navigate",
    });
  });

  it("descarta FID, métricas internas do Next e valores inválidos", () => {
    expect(buildVitalReport({ ...metric, name: "FID" }, "/a")).toBeNull();
    expect(buildVitalReport({ ...metric, name: "Next.js-hydration" }, "/a")).toBeNull();
    expect(buildVitalReport({ ...metric, value: Number.NaN }, "/a")).toBeNull();
    expect(buildVitalReport({ ...metric, value: Number.POSITIVE_INFINITY }, "/a")).toBeNull();
    expect(buildVitalReport({ ...metric, value: -1 }, "/a")).toBeNull();
    expect(buildVitalReport({ ...metric, rating: "otimo" }, "/a")).toBeNull();
    expect(buildVitalReport({ name: "LCP", value: 1 }, "/a")).toBeNull();
  });

  it("CLS fica com duas casas e rota vazia vira '/'", () => {
    expect(buildVitalReport({ name: "CLS", value: 0.012345, rating: "good" }, "")?.value).toBe(0.01);
    expect(buildVitalReport({ name: "CLS", value: 0.1, rating: "good" }, "")?.route).toBe("/");
  });

  it("limita rota e tipo de navegação", () => {
    const longo = buildVitalReport(
      { ...metric, navigationType: "x".repeat(100) },
      `/${"a".repeat(500)}`,
    );
    expect(longo?.route.length).toBeLessThanOrEqual(200);
    expect(longo?.navigationType?.length).toBeLessThanOrEqual(32);
  });
});

describe("routeForMetric", () => {
  it("TTFB, FCP e LCP pertencem à página do carregamento completo, não à rota de agora", () => {
    // Entrou por /login e seguiu para /admin sem recarregar: o LCP é o do /login.
    for (const name of ["TTFB", "FCP", "LCP"]) {
      expect(routeForMetric(name, "/admin", "https://vertice.app/login?next=/admin")).toBe("/login");
    }
  });

  it("INP e CLS valem para a rota em que a pessoa está", () => {
    expect(routeForMetric("INP", "/admin/clubes", "https://vertice.app/login")).toBe("/admin/clubes");
    expect(routeForMetric("CLS", "/admin/clubes", "https://vertice.app/login")).toBe("/admin/clubes");
  });

  it("sem URL de entrada (ou ilegível) cai na rota atual", () => {
    expect(routeForMetric("LCP", "/dashboard", null)).toBe("/dashboard");
    expect(routeForMetric("LCP", "/dashboard", undefined)).toBe("/dashboard");
    expect(routeForMetric("LCP", "/dashboard", "")).toBe("/dashboard");
    expect(routeForMetric("LCP", "/dashboard", "http://[bad")).toBe("/dashboard");
  });

  it("aceita caminho relativo", () => {
    expect(routeForMetric("TTFB", "/x", "/athletes/42?aba=1")).toBe("/athletes/42");
  });
});

describe("createVitalsDeduper", () => {
  it("TTFB, FCP e LCP: só a primeira vez por documento, mesmo com valor diferente", () => {
    const novo = createVitalsDeduper();
    expect(novo("LCP", 1200)).toBe(true);
    expect(novo("LCP", 1200)).toBe(false);
    expect(novo("LCP", 1500)).toBe(false);
    expect(novo("TTFB", 100)).toBe(true);
    expect(novo("TTFB", 100)).toBe(false);
  });

  it("INP e CLS: repetição idêntica (registro duplicado) cai; valor novo passa", () => {
    const novo = createVitalsDeduper();
    expect(novo("INP", 180)).toBe(true);
    expect(novo("INP", 180)).toBe(false);
    expect(novo("INP", 240)).toBe(true);
    expect(novo("CLS", 0.05)).toBe(true);
    expect(novo("CLS", 0.05)).toBe(false);
  });

  it("cada métrica é contada à parte", () => {
    const novo = createVitalsDeduper();
    expect(novo("FCP", 900)).toBe(true);
    expect(novo("LCP", 900)).toBe(true);
  });
});
