import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, type VitalRow } from "./vitalsPayload";
import {
  VITALS_INSERT_TIMEOUT_MS,
  VITALS_RATE_MAX,
  VITALS_RATE_WINDOW_MS,
  ingestVital,
  readBodyCapped,
  type VitalsIngestDeps,
} from "./vitalsIngest";

const metrica = { name: "LCP", value: 1800, route: "/athletes/42/dados?x=1" };
/** Um envio válido: as métricas de uma página, juntas. */
const valido = { metrics: [metrica] };

function pedido(corpo: unknown, headers: Record<string, string> = {}) {
  return new Request("https://vertice.app/api/telemetry/vitals", {
    method: "POST",
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    headers,
  });
}

function dependencias(extra: Partial<VitalsIngestDeps> = {}) {
  const linhas: VitalRow[] = [];
  const chamadas: VitalRow[][] = [];
  const deps: VitalsIngestDeps = {
    userId: async () => "usuario-1",
    allow: () => true,
    insert: async (rows) => {
      chamadas.push(rows);
      linhas.push(...rows);
      return { error: null };
    },
    ...extra,
  };
  return { deps, linhas, chamadas };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ingestVital", () => {
  it("relatório válido de usuário logado: 204 e uma linha com a rota normalizada", async () => {
    const { deps, linhas } = dependencias();
    const status = await ingestVital(
      pedido(valido, { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148" }),
      deps,
    );
    expect(status).toBe(204);
    expect(linhas).toEqual([
      { route: "/athletes/:id/dados", metric: "LCP", value: 1800, rating: "good", nav_type: null, device: "mobile" },
    ]);
  });

  it("as cinco métricas de uma página: UMA validação de sessão, UM limite consultado e UM insert em lote", async () => {
    const userId = vi.fn(async () => "usuario-1");
    const allow = vi.fn(() => true);
    const { deps, chamadas } = dependencias({ userId, allow });
    const corpo = {
      metrics: ["TTFB", "FCP", "LCP", "INP", "CLS"].map((name) => ({ name, value: name === "CLS" ? 0.04 : 400, route: "/dashboard" })),
    };

    expect(await ingestVital(pedido(corpo), deps)).toBe(204);

    expect(userId).toHaveBeenCalledTimes(1);
    expect(allow).toHaveBeenCalledTimes(1);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].map((r) => r.metric)).toEqual(["TTFB", "FCP", "LCP", "INP", "CLS"]);
  });

  it("uma métrica inválida no envio não impede as outras de serem gravadas", async () => {
    const { deps, chamadas } = dependencias();
    const corpo = { metrics: [metrica, { name: "FID", value: 1, route: "/a" }, { name: "TTFB", value: 90, route: "/a" }] };
    expect(await ingestVital(pedido(corpo), deps)).toBe(204);
    expect(chamadas[0].map((r) => r.metric)).toEqual(["LCP", "TTFB"]);
  });

  it("a nota gravada é a recalculada, não a que o navegador mandou", async () => {
    const { deps, linhas } = dependencias();
    await ingestVital(pedido({ metrics: [{ name: "LCP", value: 50_000, rating: "good", route: "/a" }] }), deps);
    expect(linhas[0].rating).toBe("poor");
  });

  it("rota com lixo é gravada como '/outras'", async () => {
    const { deps, linhas } = dependencias();
    await ingestVital(pedido({ metrics: [{ name: "LCP", value: 1, route: "/x/<img src=x>" }] }), deps);
    expect(linhas[0].route).toBe("/outras");
  });

  it("o limite é de 20 envios por minuto por usuário (um envio = uma página)", () => {
    expect(VITALS_RATE_MAX).toBe(20);
    expect(VITALS_RATE_WINDOW_MS).toBe(60_000);
  });

  it("a linha gravada não carrega usuário nem user-agent", async () => {
    const { deps, linhas } = dependencias();
    await ingestVital(pedido(valido, { "user-agent": "Mozilla/5.0 Segredo/1.0" }), deps);
    const texto = JSON.stringify(linhas);
    expect(texto).not.toContain("usuario-1");
    expect(texto).not.toContain("Segredo");
  });

  it("sem sessão: 401 e nada gravado (anônimo nunca é aceito)", async () => {
    const insert = vi.fn();
    const { deps } = dependencias({ userId: async () => null, insert });
    expect(await ingestVital(pedido(valido), deps)).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("Auth fora do ar: não grava e não vira 500", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const insert = vi.fn();
    const { deps } = dependencias({
      userId: async () => {
        throw new Error("auth indisponível");
      },
      insert,
    });
    expect(await ingestVital(pedido(valido), deps)).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("corpo maior que 2 KB: 413, sem nem verificar a sessão", async () => {
    const userId = vi.fn(async () => "u");
    const { deps } = dependencias({ userId });
    const grande = JSON.stringify({ metrics: [{ ...metrica, route: "/".padEnd(MAX_BODY_BYTES + 10, "a") }] });
    expect(await ingestVital(pedido(grande), deps)).toBe(413);
    expect(userId).not.toHaveBeenCalled();
  });

  it("Content-Length mentindo para menos não escapa: a leitura também é limitada", async () => {
    const { deps } = dependencias();
    const req = new Request("https://vertice.app/api/telemetry/vitals", {
      method: "POST",
      body: "x".repeat(MAX_BODY_BYTES + 1),
      headers: { "content-length": "10" },
    });
    expect(await ingestVital(req, deps)).toBe(413);
  });

  it("acima do limite do usuário: 204 e descarta sem gravar", async () => {
    const insert = vi.fn();
    const { deps } = dependencias({ allow: () => false, insert });
    expect(await ingestVital(pedido(valido), deps)).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("o limite é consultado com o id do usuário", async () => {
    const allow = vi.fn(() => true);
    const { deps } = dependencias({ allow });
    await ingestVital(pedido(valido), deps);
    expect(allow).toHaveBeenCalledWith("usuario-1");
  });

  it("JSON inválido e relatório inválido: 400 sem gravar", async () => {
    const insert = vi.fn();
    const { deps } = dependencias({ insert });
    expect(await ingestVital(pedido("{nao-e-json"), deps)).toBe(400);
    expect(await ingestVital(pedido({ metrics: [{ ...metrica, name: "FID" }] }), deps)).toBe(400);
    expect(await ingestVital(pedido({ metrics: [{ ...metrica, value: -3 }] }), deps)).toBe(400);
    expect(await ingestVital(pedido({ metrics: [{ ...metrica, value: 9e9 }] }), deps)).toBe(400);
    expect(await ingestVital(pedido({ metrics: [] }), deps)).toBe(400);
    // O formato antigo (uma métrica solta, sem a lista) não é mais aceito.
    expect(await ingestVital(pedido(metrica), deps)).toBe(400);
    expect(await ingestVital(pedido(""), deps)).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("falha do banco (erro devolvido, exceção ou travado) continua 204", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = dependencias({ insert: async () => ({ error: { message: "relation does not exist" } }) });
    expect(await ingestVital(pedido(valido), a.deps)).toBe(204);

    const b = dependencias({
      insert: () => {
        throw new Error("boom síncrono");
      },
    });
    expect(await ingestVital(pedido(valido), b.deps)).toBe(204);

    vi.useFakeTimers();
    const c = dependencias({ insert: () => new Promise(() => {}) });
    const pendente = ingestVital(pedido(valido), c.deps);
    await vi.advanceTimersByTimeAsync(VITALS_INSERT_TIMEOUT_MS + 10);
    expect(await pendente).toBe(204);
  });

  it("rotas /admin entram normalizadas como qualquer outra", async () => {
    const { deps, linhas } = dependencias();
    await ingestVital(pedido({ metrics: [{ ...metrica, route: "/admin/clubes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f" }] }), deps);
    expect(linhas[0].route).toBe("/admin/clubes/:id");
  });
});

describe("readBodyCapped", () => {
  it("lê o corpo inteiro quando cabe", async () => {
    expect(await readBodyCapped(pedido('{"a":"ç"}'), 100)).toBe('{"a":"ç"}');
  });

  it("corpo vazio vira texto vazio; passou do teto vira null", async () => {
    expect(await readBodyCapped(new Request("https://x", { method: "POST" }), 100)).toBe("");
    expect(await readBodyCapped(pedido("x".repeat(101)), 100)).toBeNull();
    expect(await readBodyCapped(pedido("x".repeat(100)), 100)).toBe("x".repeat(100));
  });
});
