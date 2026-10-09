import { describe, expect, it } from "vitest";
import {
  cleanDigest,
  describeRequestError,
  isNextControlSignal,
  sourceFor,
} from "./capture";

function comDigest(message: string, digest: string) {
  return Object.assign(new Error(message), { digest });
}

describe("isNextControlSignal", () => {
  it("reconhece redirecionamento, notFound e erros HTTP do Next", () => {
    expect(isNextControlSignal(comDigest("NEXT_REDIRECT", "NEXT_REDIRECT;replace;/login;307;"))).toBe(true);
    expect(isNextControlSignal(comDigest("NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK;404"))).toBe(true);
    expect(isNextControlSignal(comDigest("x", "NEXT_ANYTHING"))).toBe(true);
    expect(isNextControlSignal(comDigest("x", "DYNAMIC_SERVER_USAGE"))).toBe(true);
  });

  it("reconhece pela mensagem quando não há digest", () => {
    expect(isNextControlSignal(new Error("NEXT_REDIRECT"))).toBe(true);
    expect(isNextControlSignal(new Error("NEXT_NOT_FOUND"))).toBe(true);
  });

  it("erro de verdade não é sinal de controle", () => {
    expect(isNextControlSignal(new Error("falha ao ler clubes"))).toBe(false);
    expect(isNextControlSignal(comDigest("falha", "1234567890"))).toBe(false);
    expect(isNextControlSignal("NEXT")).toBe(false);
    expect(isNextControlSignal(null)).toBe(false);
  });
});

describe("sourceFor", () => {
  it("separa webhooks e crons de 'route'", () => {
    expect(sourceFor("route", "/api/webhooks/asaas/:id")).toBe("webhook");
    expect(sourceFor("route", "/api/cron/club-retention")).toBe("cron");
    expect(sourceFor("route", "/api/outra")).toBe("route");
  });

  it("repassa o tipo do Next e cai em 'route' quando desconhecido", () => {
    expect(sourceFor("render", "/dashboard")).toBe("render");
    expect(sourceFor("action", "/dashboard")).toBe("action");
    expect(sourceFor("proxy", "/dashboard")).toBe("proxy");
    expect(sourceFor(undefined, "/dashboard")).toBe("route");
    expect(sourceFor("outro", "/dashboard")).toBe("route");
  });
});

describe("cleanDigest", () => {
  it("mantém só caracteres inofensivos e limita o tamanho", () => {
    expect(cleanDigest("1234567890")).toBe("1234567890");
    expect(cleanDigest("ab<script>cd")).toBe("abscriptcd");
    expect(cleanDigest("x".repeat(200))).toHaveLength(64);
    expect(cleanDigest("<>")).toBeNull();
    expect(cleanDigest(null)).toBeNull();
  });
});

describe("describeRequestError", () => {
  it("monta o rascunho com rota do padrão, mensagem limpa e digest", () => {
    const draft = describeRequestError(
      comDigest("Falha para ana@clube.com no clube 8f14e45f-ceea-467a-9575-0a1b2c3d4e5f", "987654"),
      { path: "/athletes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f/dados?aba=1", method: "get" },
      { routePath: "/(coach)/athletes/[athleteId]/dados/page", routeType: "render" },
    );
    expect(draft).not.toBeNull();
    expect(draft).toMatchObject({
      source: "render",
      severity: "error",
      route: "/athletes/:id/dados",
      method: "GET",
      digest: "987654",
      statusCode: null,
      clubId: null,
    });
    expect(draft!.message).not.toContain("ana@clube.com");
    expect(draft!.message).not.toContain("8f14e45f");
  });

  it("webhook por clube vira source webhook e a rota nunca carrega o token", () => {
    const draft = describeRequestError(
      new Error("boom"),
      { path: "/api/webhooks/asaas/TOKEN-SECRETO-DO-CLUBE", method: "POST" },
      { routePath: "/api/webhooks/asaas/[token]/route", routeType: "route" },
    );
    expect(draft?.source).toBe("webhook");
    expect(draft?.route).toBe("/api/webhooks/asaas/:id");
    expect(JSON.stringify(draft)).not.toContain("TOKEN-SECRETO");
  });

  it("no proxy usa o caminho real normalizado (routePath não é rota de página)", () => {
    const draft = describeRequestError(
      new Error("boom"),
      { path: "/athletes/42/dados", method: "GET" },
      { routePath: "/", routeType: "proxy" },
    );
    expect(draft?.source).toBe("proxy");
    expect(draft?.route).toBe("/athletes/:id/dados");
  });

  it("sem contexto cai no caminho normalizado", () => {
    const draft = describeRequestError(new Error("boom"), { path: "/x/99?y=1" }, undefined);
    expect(draft?.route).toBe("/x/:id");
    expect(draft?.method).toBeNull();
  });

  it("devolve null para sinais de controle do Next", () => {
    expect(
      describeRequestError(comDigest("NEXT_REDIRECT", "NEXT_REDIRECT;push;/admin;307;"), { path: "/a" }, undefined),
    ).toBeNull();
  });

  it("prefixa o nome do erro quando ele ajuda a agrupar", () => {
    const draft = describeRequestError(new TypeError("x is undefined"), { path: "/a" }, undefined);
    expect(draft?.message).toBe("TypeError: x is undefined");
    const generic = describeRequestError(new Error("x is undefined"), { path: "/a" }, undefined);
    expect(generic?.message).toBe("x is undefined");
  });

  it("rebaixa a warn o que não é defeito nosso", () => {
    const draft = describeRequestError(new Error("read ECONNRESET"), { path: "/a" }, undefined);
    expect(draft?.severity).toBe("warn");
  });

  it("não lê cabeçalhos, cookies nem corpo do pedido", () => {
    const request = {
      path: "/a",
      method: "POST",
      get headers(): never {
        throw new Error("não devia ler headers");
      },
    };
    expect(() => describeRequestError(new Error("boom"), request, undefined)).not.toThrow();
    expect(describeRequestError(new Error("boom"), request, undefined)).not.toBeNull();
  });

  it("não lança nem com valores estranhos", () => {
    expect(() => describeRequestError(undefined, undefined, undefined)).not.toThrow();
    expect(describeRequestError(undefined, undefined, undefined)?.route).toBe("/");
    expect(() => describeRequestError(Object.create(null), undefined, undefined)).not.toThrow();
  });
});
