import { describe, expect, it } from "vitest";
import { normalizeRoute, routeFromPattern } from "./route";

describe("normalizeRoute", () => {
  it("troca UUIDs e números por :id", () => {
    expect(normalizeRoute("/athletes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f/dados")).toBe("/athletes/:id/dados");
    expect(normalizeRoute("/jogos/123/sumula")).toBe("/jogos/:id/sumula");
  });

  it("nunca guarda a query string nem o fragmento", () => {
    expect(normalizeRoute("/dashboard?token=abc&x=1")).toBe("/dashboard");
    expect(normalizeRoute("/dashboard#secao")).toBe("/dashboard");
    expect(normalizeRoute("/athletes/42?aba=financeiro")).toBe("/athletes/:id");
  });

  it("aceita URL absoluta e descarta o host", () => {
    expect(normalizeRoute("https://vertice.app/admin/clubes?x=1")).toBe("/admin/clubes");
  });

  it("segmentos depois de /c, /convite e do webhook por clube são sempre :id", () => {
    expect(normalizeRoute("/c/vertice-demo")).toBe("/c/:id");
    expect(normalizeRoute("/convite/abc")).toBe("/convite/:id");
    expect(normalizeRoute("/api/webhooks/asaas/Ab3dE9")).toBe("/api/webhooks/asaas/:id");
    // O webhook global não tem token no caminho e não é confundido com o por clube.
    expect(normalizeRoute("/api/webhooks/asaas-platform")).toBe("/api/webhooks/asaas-platform");
  });

  it("trata token opaco longo e texto codificado como dinâmico", () => {
    expect(normalizeRoute("/x/Zm9vYmFyQmF6MTIzNDU2Nzg5")).toBe("/x/:id");
    expect(normalizeRoute("/busca/ana%40x.com")).toBe("/busca/:id");
    expect(normalizeRoute("/u/ana@x.com")).toBe("/u/:id");
  });

  it("mantém nomes de tela, mesmo longos e com hífen", () => {
    expect(normalizeRoute("/admin/saude")).toBe("/admin/saude");
    expect(normalizeRoute("/evolucao-financeira-sub")).toBe("/evolucao-financeira-sub");
  });

  it("rotas /admin entram normalizadas como as outras", () => {
    expect(normalizeRoute("/admin/clubes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f")).toBe("/admin/clubes/:id");
  });

  it("entrada vazia, nula ou lixo vira '/' e nunca lança", () => {
    expect(normalizeRoute("")).toBe("/");
    expect(normalizeRoute(null)).toBe("/");
    expect(normalizeRoute(undefined)).toBe("/");
    expect(normalizeRoute("///")).toBe("/");
    expect(normalizeRoute(123 as unknown as string)).toBe("/");
  });

  it("corta rotas absurdamente longas", () => {
    expect(normalizeRoute(`/${"a/".repeat(300)}`).length).toBeLessThanOrEqual(200);
  });

  it("é idempotente", () => {
    const uma = normalizeRoute("/athletes/42/dados?x=1");
    expect(normalizeRoute(uma)).toBe(uma);
  });
});

describe("routeFromPattern", () => {
  it("tira grupos de rota, slots e o sufixo /page", () => {
    expect(routeFromPattern("/(coach)/athletes/[athleteId]/dados/page")).toBe("/athletes/:id/dados");
    expect(routeFromPattern("/(admin)/admin/saude/page")).toBe("/admin/saude");
    expect(routeFromPattern("/@modal/foto/page")).toBe("/foto");
  });

  it("troca [id], [...x] e [[...x]] por :id e tira /route", () => {
    expect(routeFromPattern("/api/webhooks/asaas/[token]/route")).toBe("/api/webhooks/asaas/:id");
    expect(routeFromPattern("/docs/[...slug]/page")).toBe("/docs/:id");
    expect(routeFromPattern("/docs/[[...slug]]/page")).toBe("/docs/:id");
  });

  it("padrão da raiz vira '/'", () => {
    expect(routeFromPattern("/page")).toBe("/");
  });

  it("devolve null quando não é um padrão utilizável", () => {
    expect(routeFromPattern(undefined)).toBeNull();
    expect(routeFromPattern("")).toBeNull();
    expect(routeFromPattern("sem-barra")).toBeNull();
  });
});
