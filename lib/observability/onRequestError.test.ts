import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const gravados = vi.hoisted(() => ({ lista: [] as unknown[], falhar: false }));

vi.mock("@/lib/observability/record", () => ({
  recordSystemEvent: async (draft: unknown) => {
    if (gravados.falhar) throw new Error("registro quebrou");
    gravados.lista.push(draft);
    return true;
  },
}));

import { handleRequestError } from "./onRequestError";

beforeEach(() => {
  gravados.lista = [];
  gravados.falhar = false;
});

describe("handleRequestError", () => {
  it("grava o erro de uma rota com source e rota normalizados", async () => {
    await handleRequestError(
      new Error("boom"),
      { path: "/api/webhooks/asaas/TOKEN", method: "POST" },
      { routePath: "/api/webhooks/asaas/[token]/route", routeType: "route" },
    );
    expect(gravados.lista).toHaveLength(1);
    expect(gravados.lista[0]).toMatchObject({ source: "webhook", route: "/api/webhooks/asaas/:id" });
  });

  it("ignora redirecionamentos e notFound", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await handleRequestError(redirect, { path: "/admin" }, { routeType: "render" });
    expect(gravados.lista).toHaveLength(0);
  });

  it("NUNCA rejeita, nem se o registro quebrar", async () => {
    gravados.falhar = true;
    await expect(
      handleRequestError(new Error("boom"), { path: "/a" }, { routeType: "route" }),
    ).resolves.toBeUndefined();
  });
});
