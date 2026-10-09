import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  usuario: { id: "u-1" } as { id: string } | null,
  /** Cada chamada ao insert, com as linhas recebidas de uma vez. */
  insercoes: [] as Array<{ tabela: string; linhas: Array<Record<string, unknown>> }>,
  autenticacoes: 0,
  erroNoBanco: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        estado.autenticacoes += 1;
        return { data: { user: estado.usuario }, error: null };
      },
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      insert: async (linhas: Array<Record<string, unknown>>) => {
        estado.insercoes.push({ tabela, linhas });
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

const metrica = { name: "INP", value: 180, route: "/admin/clubes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f?x=1" };
const relatorio = { metrics: [metrica] };

const linhasGravadas = () => estado.insercoes.flatMap((i) => i.linhas);

beforeEach(() => {
  estado.usuario = { id: "u-1" };
  estado.insercoes = [];
  estado.autenticacoes = 0;
  estado.erroNoBanco = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/telemetry/vitals", () => {
  it("usuário logado: 204 sem corpo e uma linha em web_vitals com a rota normalizada", async () => {
    const r = await enviar(relatorio, { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile" });

    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
    expect(estado.insercoes).toEqual([
      {
        tabela: "web_vitals",
        linhas: [
          {
            route: "/admin/clubes/:id",
            metric: "INP",
            value: 180,
            rating: "good",
            nav_type: null,
            device: "mobile",
          },
        ],
      },
    ]);
  });

  it("uma página inteira (5 métricas) custa UMA validação de sessão e UM insert em lote", async () => {
    const corpo = {
      metrics: [
        { name: "TTFB", value: 120, route: "/dashboard" },
        { name: "FCP", value: 900, route: "/dashboard" },
        { name: "LCP", value: 1800, route: "/dashboard" },
        { name: "INP", value: 150, route: "/dashboard" },
        { name: "CLS", value: 0.02, route: "/dashboard" },
      ],
    };
    const r = await enviar(corpo);

    expect(r.status).toBe(204);
    expect(estado.autenticacoes).toBe(1);
    expect(estado.insercoes).toHaveLength(1);
    expect(estado.insercoes[0].linhas.map((l) => l.metric)).toEqual(["TTFB", "FCP", "LCP", "INP", "CLS"]);
  });

  it("anônimo: 401 e nada gravado", async () => {
    estado.usuario = null;
    const r = await enviar(relatorio);
    expect(r.status).toBe(401);
    expect(estado.insercoes).toHaveLength(0);
  });

  it("relatório inválido: 400; corpo grande: 413; nada gravado em nenhum", async () => {
    expect((await enviar({ metrics: [{ ...metrica, name: "FID" }] })).status).toBe(400);
    expect((await enviar("não é json")).status).toBe(400);
    expect((await enviar({ metrics: [{ ...metrica, route: "/".padEnd(5_000, "a") }] })).status).toBe(413);
    expect(estado.insercoes).toHaveLength(0);
  });

  it("banco com erro: continua 204 (ninguém pode refazer um beacon)", async () => {
    estado.erroNoBanco = true;
    expect((await enviar(relatorio)).status).toBe(204);
  });

  it("limita por usuário: depois de 20 envios no minuto, descarta calado com 204", async () => {
    estado.usuario = { id: "u-limite" };
    for (let i = 0; i < 20; i++) expect((await enviar(relatorio)).status).toBe(204);
    expect(linhasGravadas()).toHaveLength(20);

    expect((await enviar(relatorio)).status).toBe(204);
    expect(linhasGravadas()).toHaveLength(20);

    // Outro usuário não é afetado.
    estado.usuario = { id: "u-outro" };
    await enviar(relatorio);
    expect(linhasGravadas()).toHaveLength(21);
  });

  it("responde com cache-control: no-store", async () => {
    const r = await enviar(relatorio);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});
