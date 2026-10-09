import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  usuario: { id: "u-1" } as { id: string } | null,
  linhas: [] as Array<{ tabela: string; linha: Record<string, unknown> }>,
  erroNoBanco: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: estado.usuario }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      insert: async (linha: Record<string, unknown>) => {
        estado.linhas.push({ tabela, linha });
        return estado.erroNoBanco ? { error: { message: "relation does not exist" } } : { error: null };
      },
    }),
  }),
}));

import { POST } from "./route";

function enviar(corpo: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://vertice.app/api/telemetry/vitals", {
      method: "POST",
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
      headers,
    }),
  );
}

const relatorio = { name: "INP", value: 180, rating: "good", route: "/admin/clubes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f?x=1" };

beforeEach(() => {
  estado.usuario = { id: "u-1" };
  estado.linhas = [];
  estado.erroNoBanco = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/telemetry/vitals", () => {
  it("usuário logado: 204 sem corpo e uma linha em web_vitals com a rota normalizada", async () => {
    const r = await enviar(relatorio, { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile" });

    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
    expect(estado.linhas).toEqual([
      {
        tabela: "web_vitals",
        linha: {
          route: "/admin/clubes/:id",
          metric: "INP",
          value: 180,
          rating: "good",
          nav_type: null,
          device: "mobile",
        },
      },
    ]);
  });

  it("anônimo: 401 e nada gravado", async () => {
    estado.usuario = null;
    const r = await enviar(relatorio);
    expect(r.status).toBe(401);
    expect(estado.linhas).toHaveLength(0);
  });

  it("relatório inválido: 400; corpo grande: 413; nada gravado em nenhum", async () => {
    expect((await enviar({ ...relatorio, name: "FID" })).status).toBe(400);
    expect((await enviar("não é json")).status).toBe(400);
    expect((await enviar({ ...relatorio, route: "/".padEnd(5_000, "a") })).status).toBe(413);
    expect(estado.linhas).toHaveLength(0);
  });

  it("banco com erro: continua 204 (ninguém pode refazer um beacon)", async () => {
    estado.erroNoBanco = true;
    expect((await enviar(relatorio)).status).toBe(204);
  });

  it("limita por usuário: depois de 60 no minuto, descarta calado com 204", async () => {
    estado.usuario = { id: "u-limite" };
    for (let i = 0; i < 60; i++) expect((await enviar(relatorio)).status).toBe(204);
    expect(estado.linhas).toHaveLength(60);

    expect((await enviar(relatorio)).status).toBe(204);
    expect(estado.linhas).toHaveLength(60);

    // Outro usuário não é afetado.
    estado.usuario = { id: "u-outro" };
    await enviar(relatorio);
    expect(estado.linhas).toHaveLength(61);
  });

  it("responde com cache-control: no-store", async () => {
    const r = await enviar(relatorio);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});
