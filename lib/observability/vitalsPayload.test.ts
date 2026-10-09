import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, deviceFromUserAgent, parseVitalPayload } from "./vitalsPayload";

const valido = { name: "LCP", value: 1800, rating: "good", route: "/dashboard", navigationType: "navigate" };

describe("parseVitalPayload", () => {
  it("aceita um relatório válido e devolve a linha para web_vitals", () => {
    expect(parseVitalPayload(valido, "Mozilla/5.0 (Windows NT 10.0)")).toEqual({
      route: "/dashboard",
      metric: "LCP",
      value: 1800,
      rating: "good",
      nav_type: "navigate",
      device: "desktop",
    });
  });

  it("NORMALIZA a rota no servidor (não confia no cliente)", () => {
    const row = parseVitalPayload(
      { ...valido, route: "/athletes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f/dados?x=1" },
      null,
    );
    expect(row?.route).toBe("/athletes/:id/dados");
    expect(parseVitalPayload({ ...valido, route: "/admin/clubes/42" }, null)?.route).toBe("/admin/clubes/:id");
  });

  it("aceita as cinco métricas e recusa as demais", () => {
    for (const name of ["LCP", "INP", "TTFB", "FCP"]) {
      expect(parseVitalPayload({ ...valido, name }, null)?.metric).toBe(name);
    }
    expect(parseVitalPayload({ ...valido, name: "CLS", value: 0.05 }, null)?.metric).toBe("CLS");
    expect(parseVitalPayload({ ...valido, name: "FID" }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, name: "lcp" }, null)).toBeNull();
  });

  it("recusa valor negativo, não numérico ou acima do teto da métrica", () => {
    expect(parseVitalPayload({ ...valido, value: -1 }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, value: "100" }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, value: null }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, value: 120_001 }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, value: 120_000 }, null)?.value).toBe(120_000);
    expect(parseVitalPayload({ ...valido, name: "CLS", value: 51 }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, value: 1e12 }, null)).toBeNull();
  });

  it("recusa rating fora da lista, rota vazia/longa e corpo que não é objeto", () => {
    expect(parseVitalPayload({ ...valido, rating: "excelente" }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, route: "" }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, route: "/".padEnd(201, "a") }, null)).toBeNull();
    expect(parseVitalPayload({ ...valido, route: 5 }, null)).toBeNull();
    expect(parseVitalPayload(null, null)).toBeNull();
    expect(parseVitalPayload("texto", null)).toBeNull();
    expect(parseVitalPayload([valido], null)).toBeNull();
  });

  it("tipo de navegação desconhecido vira null em vez de ir para o banco", () => {
    expect(parseVitalPayload({ ...valido, navigationType: "<script>" }, null)?.nav_type).toBeNull();
    expect(parseVitalPayload({ ...valido, navigationType: undefined }, null)?.nav_type).toBeNull();
    expect(parseVitalPayload({ ...valido, navigationType: "back-forward-cache" }, null)?.nav_type).toBe(
      "back-forward-cache",
    );
  });

  it("deduz mobile a partir do user-agent", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    expect(parseVitalPayload(valido, ua)?.device).toBe("mobile");
  });

  it("o teto do corpo é pequeno (2 KB)", () => {
    expect(MAX_BODY_BYTES).toBe(2_048);
  });
});

describe("deviceFromUserAgent", () => {
  it("celular e tablet são mobile; o resto é desktop", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120")).toBe("desktop");
    expect(deviceFromUserAgent("Mozilla/5.0 (X11; Linux x86_64) Firefox/120")).toBe("desktop");
  });

  it("ausente é desktop", () => {
    expect(deviceFromUserAgent(null)).toBe("desktop");
    expect(deviceFromUserAgent(undefined)).toBe("desktop");
    expect(deviceFromUserAgent("")).toBe("desktop");
  });
});
