import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const registro = vi.hoisted(() => ({ lista: [] as Array<Record<string, unknown>>, falhar: false }));

vi.mock("@/lib/observability/record", () => ({
  recordSystemEvent: async (draft: Record<string, unknown>) => {
    if (registro.falhar) throw new Error("registro quebrou");
    registro.lista.push(draft);
    return true;
  },
}));

import { wasRecorded } from "./dedupe";
import { recordWebhookFailure, withWebhookCapture } from "./webhook";

beforeEach(() => {
  registro.lista = [];
  registro.falhar = false;
});

describe("withWebhookCapture", () => {
  it("devolve a MESMA resposta do handler (status e corpo intactos) e não registra nada", async () => {
    const resposta = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const handler = vi.fn(async (...args: Request[]) => {
      void args;
      return resposta;
    });
    const capturado = withWebhookCapture("/api/webhooks/asaas", handler);

    const req = new Request("https://x/api/webhooks/asaas", { method: "POST" });
    const out = await capturado(req);

    expect(out).toBe(resposta);
    expect(out.status).toBe(401);
    expect(handler).toHaveBeenCalledWith(req);
    expect(registro.lista).toHaveLength(0);
  });

  it("repassa os argumentos (contexto de rota com params)", async () => {
    const handler = vi.fn(async (...args: [Request, { params: Promise<{ token: string }> }]) => {
      void args;
      return new Response(null, { status: 200 });
    });
    const capturado = withWebhookCapture("/api/webhooks/asaas/:id", handler);
    const ctx = { params: Promise.resolve({ token: "t" }) };
    await capturado(new Request("https://x"), ctx);
    expect(handler.mock.calls[0][1]).toBe(ctx);
  });

  it("exceção: registra source webhook com a rota ESTÁTICA, relança a mesma exceção e marca como registrada", async () => {
    const erro = new Error("insert falhou para ana@x.com");
    const capturado = withWebhookCapture("/api/webhooks/asaas/:id", async () => {
      throw erro;
    });

    await expect(capturado()).rejects.toBe(erro);

    expect(registro.lista).toHaveLength(1);
    expect(registro.lista[0]).toMatchObject({
      source: "webhook",
      severity: "error",
      route: "/api/webhooks/asaas/:id",
      method: "POST",
      clubId: null,
    });
    expect(String(registro.lista[0].message)).not.toContain("ana@x.com");
    // Para o onRequestError não contar a mesma exceção de novo.
    expect(wasRecorded(erro)).toBe(true);
  });

  it("se o registro quebrar, quem sobe é a exceção ORIGINAL", async () => {
    registro.falhar = true;
    const erro = new Error("original");
    const capturado = withWebhookCapture("/api/webhooks/asaas-platform", async () => {
      throw erro;
    });
    await expect(capturado()).rejects.toBe(erro);
  });

  it("aceita exceção que não é Error", async () => {
    const capturado = withWebhookCapture("/api/webhooks/asaas-withdraw-auth", async () => {
      throw "texto solto";
    });
    await expect(capturado()).rejects.toBe("texto solto");
    expect(registro.lista[0].message).toBe("texto solto");
  });
});

describe("recordWebhookFailure", () => {
  it("registra uma falha tratada e nunca lança", async () => {
    await recordWebhookFailure("/api/webhooks/asaas/:id", "falha ao resolver o clube do webhook: timeout");
    expect(registro.lista[0]).toMatchObject({ source: "webhook", route: "/api/webhooks/asaas/:id" });

    registro.falhar = true;
    await expect(recordWebhookFailure("/api/webhooks/asaas", new Error("x"))).resolves.toBeUndefined();
  });
});
