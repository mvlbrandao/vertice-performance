import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Os quatro webhooks do Asaas: a captura de falhas não pode mudar status,
 * corpo nem autenticação. Aqui cada rota roda de verdade; só o banco, o
 * resolvedor de token do clube e o registro de eventos são trocados.
 */

const estado = vi.hoisted(() => ({
  eventos: [] as Array<Record<string, unknown>>,
  bancoLanca: true,
  tokenResolve: "club-1" as string | null | Error,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (estado.bancoLanca) throw new Error("banco fora do ar para ana@clube.com");
    throw new Error("não esperado");
  },
}));
vi.mock("@/lib/asaas/credentials", () => ({
  clubIdForWebhookToken: async () => {
    if (estado.tokenResolve instanceof Error) throw estado.tokenResolve;
    return estado.tokenResolve;
  },
}));
vi.mock("@/lib/observability/record", () => ({
  recordSystemEvent: async (draft: Record<string, unknown>) => {
    estado.eventos.push(draft);
    return true;
  },
}));

import { POST as asaas } from "./asaas/route";
import { POST as asaasPorClube } from "./asaas/[token]/route";
import { POST as asaasPlataforma } from "./asaas-platform/route";
import { POST as asaasSaque } from "./asaas-withdraw-auth/route";

const corpo = JSON.stringify({
  event: "PAYMENT_RECEIVED",
  type: "TRANSFER",
  payment: { id: "pay_1", value: 100, status: "RECEIVED", dueDate: "2026-10-08" },
});

function pedido(token?: string) {
  return new Request("https://vertice.app/api/webhooks/x", {
    method: "POST",
    body: corpo,
    headers: token ? { "asaas-access-token": token } : {},
  });
}

const contextoToken = { params: Promise.resolve({ token: "TOKEN-SECRETO-DO-CLUBE" }) };

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = "t-global";
  process.env.ASAAS_PLATFORM_WEBHOOK_TOKEN = "t-plataforma";
  process.env.ASAAS_WITHDRAW_WEBHOOK_TOKEN = "t-saque";
  estado.eventos = [];
  estado.bancoLanca = true;
  estado.tokenResolve = "club-1";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  delete process.env.ASAAS_PLATFORM_WEBHOOK_TOKEN;
  delete process.env.ASAAS_WITHDRAW_WEBHOOK_TOKEN;
});

describe("autenticação e respostas inalteradas", () => {
  it("token ausente ou errado continua 401, sem registrar evento", async () => {
    for (const rota of [asaas, asaasPlataforma, asaasSaque]) {
      const semToken = await rota(pedido());
      expect(semToken.status).toBe(401);
      expect(await semToken.json()).toEqual({ error: "unauthorized" });
      expect((await rota(pedido("errado"))).status).toBe(401);
    }
    expect(estado.eventos).toHaveLength(0);
  });

  it("token de clube desconhecido continua 404 e payload inválido, 400", async () => {
    estado.tokenResolve = null;
    const r = await asaasPorClube(pedido(), contextoToken);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "not found" });

    estado.tokenResolve = "club-1";
    const invalido = await asaasPorClube(
      new Request("https://vertice.app/api/webhooks/asaas/t", { method: "POST", body: "{}" }),
      contextoToken,
    );
    expect(invalido.status).toBe(400);
    expect(estado.eventos).toHaveLength(0);
  });
});

describe("exceção não tratada", () => {
  it.each([
    ["/api/webhooks/asaas", () => asaas(pedido("t-global"))],
    ["/api/webhooks/asaas-platform", () => asaasPlataforma(pedido("t-plataforma"))],
    ["/api/webhooks/asaas-withdraw-auth", () => asaasSaque(pedido("t-saque"))],
    ["/api/webhooks/asaas/:id", () => asaasPorClube(pedido(), contextoToken)],
  ])("%s: registra source webhook e a MESMA exceção sobe (o Next responde 500 como antes)", async (rota, chamar) => {
    await expect(chamar()).rejects.toThrow("banco fora do ar");

    expect(estado.eventos).toHaveLength(1);
    expect(estado.eventos[0]).toMatchObject({ source: "webhook", route: rota, method: "POST", clubId: null });
    // Nem o e-mail da mensagem nem o token do caminho vão para a telemetria.
    const texto = JSON.stringify(estado.eventos);
    expect(texto).not.toContain("ana@clube.com");
    expect(texto).not.toContain("TOKEN-SECRETO");
  });
});

describe("webhook por clube: falha ao resolver o token", () => {
  it("continua 503 com o mesmo corpo, e agora a falha fica registrada", async () => {
    estado.tokenResolve = new Error("canceling statement due to statement timeout");
    const r = await asaasPorClube(pedido(), contextoToken);

    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "unavailable" });
    expect(estado.eventos).toHaveLength(1);
    expect(estado.eventos[0]).toMatchObject({ source: "webhook", route: "/api/webhooks/asaas/:id" });
    expect(String(estado.eventos[0].message)).toContain("statement timeout");
  });
});
