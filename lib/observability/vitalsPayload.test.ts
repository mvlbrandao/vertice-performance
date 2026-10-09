import { describe, expect, it } from "vitest";
import {
  MAX_BODY_BYTES,
  UNKNOWN_ROUTE,
  deviceFromUserAgent,
  parseVitalsBatch,
  vitalRoute,
} from "./vitalsPayload";

const lcp = { name: "LCP", value: 1800, route: "/dashboard", navigationType: "navigate" };
const lote = (...metrics: unknown[]) => ({ metrics });

describe("parseVitalsBatch", () => {
  it("aceita um envio válido e devolve as linhas para web_vitals", () => {
    expect(parseVitalsBatch(lote(lcp), "Mozilla/5.0 (Windows NT 10.0)")).toEqual([
      {
        route: "/dashboard",
        metric: "LCP",
        value: 1800,
        rating: "good",
        nav_type: "navigate",
        device: "desktop",
      },
    ]);
  });

  it("aceita as cinco métricas de uma página num só envio", () => {
    const rows = parseVitalsBatch(
      lote(
        { name: "TTFB", value: 120, route: "/dashboard" },
        { name: "FCP", value: 900, route: "/dashboard" },
        { name: "LCP", value: 1800, route: "/dashboard" },
        { name: "INP", value: 150, route: "/dashboard" },
        { name: "CLS", value: 0.02, route: "/dashboard" },
      ),
      null,
    );
    expect(rows.map((r) => r.metric)).toEqual(["TTFB", "FCP", "LCP", "INP", "CLS"]);
  });

  it("NORMALIZA a rota no servidor (não confia no cliente)", () => {
    const rows = parseVitalsBatch(
      lote(
        { ...lcp, route: "/athletes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f/dados?x=1" },
        { name: "INP", value: 10, route: "/admin/clubes/42" },
      ),
      null,
    );
    expect(rows.map((r) => r.route)).toEqual(["/athletes/:id/dados", "/admin/clubes/:id"]);
  });

  it("recalcula a nota a partir do valor: a que o cliente manda não entra", () => {
    const rows = parseVitalsBatch(
      lote(
        { ...lcp, value: 100_000 - 50_000, rating: "good" },
        { name: "INP", value: 100, rating: "poor", route: "/a" },
        { name: "CLS", value: 0.15, rating: "good", route: "/a" },
      ),
      null,
    );
    expect(rows.map((r) => [r.metric, r.rating])).toEqual([
      ["LCP", "poor"],
      ["INP", "good"],
      ["CLS", "needs-improvement"],
    ]);
  });

  it("uma métrica inválida não derruba as outras do mesmo envio", () => {
    const rows = parseVitalsBatch(
      lote(lcp, { name: "FID", value: 10, route: "/a" }, { name: "INP", value: -4, route: "/a" }, { name: "TTFB", value: 90, route: "/a" }),
      null,
    );
    expect(rows.map((r) => r.metric)).toEqual(["LCP", "TTFB"]);
  });

  it("repetir a mesma métrica no envio não multiplica amostras: vale a primeira", () => {
    const rows = parseVitalsBatch(lote(lcp, { ...lcp, value: 5 }, { ...lcp, value: 6 }), null);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(1800);
  });

  it("recusa envio vazio, com mais de 5 métricas, ou que não é objeto com a lista", () => {
    expect(parseVitalsBatch(lote(), null)).toEqual([]);
    expect(parseVitalsBatch(lote(...Array.from({ length: 6 }, () => lcp)), null)).toEqual([]);
    expect(parseVitalsBatch({ metrics: "LCP" }, null)).toEqual([]);
    expect(parseVitalsBatch(lcp, null)).toEqual([]);
    expect(parseVitalsBatch(null, null)).toEqual([]);
    expect(parseVitalsBatch("texto", null)).toEqual([]);
    expect(parseVitalsBatch([lcp], null)).toEqual([]);
  });

  it("recusa valor negativo, não numérico ou acima do teto realista da métrica", () => {
    const um = (extra: object) => parseVitalsBatch(lote({ ...lcp, ...extra }), null);
    expect(um({ value: -1 })).toEqual([]);
    expect(um({ value: "100" })).toEqual([]);
    expect(um({ value: null })).toEqual([]);
    expect(um({ value: 1e12 })).toEqual([]);
    // 60 s é o teto dos tempos; acima disso não é medição de página.
    expect(um({ value: 60_001 })).toEqual([]);
    expect(um({ value: 60_000 })[0]?.value).toBe(60_000);
    expect(um({ name: "CLS", value: 10.5 })).toEqual([]);
    expect(um({ name: "CLS", value: 10 })[0]?.value).toBe(10);
    expect(um({ name: "INP", value: 120_000 })).toEqual([]);
  });

  it("recusa métrica desconhecida, rota vazia/longa e campos de tipo errado", () => {
    const um = (extra: object) => parseVitalsBatch(lote({ ...lcp, ...extra }), null);
    expect(um({ name: "FID" })).toEqual([]);
    expect(um({ name: "lcp" })).toEqual([]);
    expect(um({ route: "" })).toEqual([]);
    expect(um({ route: "/".padEnd(201, "a") })).toEqual([]);
    expect(um({ route: 5 })).toEqual([]);
  });

  it("tipo de navegação desconhecido vira null em vez de ir para o banco", () => {
    const um = (navigationType: unknown) => parseVitalsBatch(lote({ ...lcp, navigationType }), null)[0].nav_type;
    expect(um("<script>")).toBeNull();
    expect(um(undefined)).toBeNull();
    expect(um("back-forward-cache")).toBe("back-forward-cache");
  });

  it("deduz mobile a partir do user-agent (o mesmo para todas as linhas)", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    const rows = parseVitalsBatch(lote(lcp, { name: "FCP", value: 10, route: "/a" }), ua);
    expect(rows.map((r) => r.device)).toEqual(["mobile", "mobile"]);
  });

  it("o teto do corpo é pequeno (2 KB) e um envio completo cabe com folga", () => {
    expect(MAX_BODY_BYTES).toBe(2_048);
    const completo = lote(
      ...["TTFB", "FCP", "LCP", "INP", "CLS"].map((name) => ({
        name,
        value: 1234.56,
        route: "/athletes/00000000-0000-0000-0000-000000000000/dados",
        navigationType: "back-forward-cache",
      })),
    );
    expect(JSON.stringify(completo).length).toBeLessThan(MAX_BODY_BYTES / 2);
  });
});

describe("vitalRoute (rota só no formato de rota do app)", () => {
  it("rotas reais do app passam, já normalizadas", () => {
    expect(vitalRoute("/")).toBe("/");
    expect(vitalRoute("/dashboard")).toBe("/dashboard");
    expect(vitalRoute("/athletes/42/dados?x=1")).toBe("/athletes/:id/dados");
    expect(vitalRoute("/evolucao-financeira-sub")).toBe("/evolucao-financeira-sub");
    expect(vitalRoute("/admin/clubes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f/contratos")).toBe("/admin/clubes/:id/contratos");
    expect(vitalRoute("/c/qualquer-slug")).toBe("/c/:id");
  });

  it("lixo vira '/outras' em vez de uma linha nova (e nunca chega à tela como HTML)", () => {
    for (const lixo of [
      "/minha/rota/<img src=x>",
      "/a b",
      "/a\nc",
      "/Admin",
      '/x"y',
      "/x'y",
      "/a;b",
      "/a/../b",
      "/a/b/c/d/e/f/g",
      "//",
      "javascript:alert(1)",
      "/ação",
    ]) {
      const rota = vitalRoute(lixo);
      expect(rota === UNKNOWN_ROUTE || /^\/[a-z0-9_:/-]*$/.test(rota), lixo).toBe(true);
      expect(rota).not.toMatch(/[<>"' ]/);
    }
    expect(vitalRoute("/minha/rota/<img src=x>")).toBe(UNKNOWN_ROUTE);
    expect(vitalRoute("/Admin")).toBe(UNKNOWN_ROUTE);
    expect(vitalRoute("/a/b/c/d/e/f/g")).toBe(UNKNOWN_ROUTE);
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
