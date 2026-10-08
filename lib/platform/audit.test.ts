import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  actor: null as { userId: string; email: string; fullName: string } | null,
  forwarded: null as string | null,
  insertResult: { error: null } as { error: { code?: string; message: string } | null },
  insertThrows: false,
  inserted: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? h.forwarded : null) }),
}));

vi.mock("@/lib/platform/admin", () => ({
  getPlatformAdmin: async () => h.actor,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: unknown) => {
        if (h.insertThrows) throw new Error("rede caiu");
        h.inserted.push({ table, row });
        return h.insertResult;
      },
    }),
  }),
}));

import { logPlatformAction } from "./audit";

const CLUBE = { id: "c-1", name: "Clube Teste" };

beforeEach(() => {
  h.actor = { userId: "u-1", email: "dono@exemplo.com", fullName: "Dono" };
  h.forwarded = "203.0.113.7, 10.0.0.1";
  h.insertResult = { error: null };
  h.insertThrows = false;
  h.inserted = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// Sem restaurar, os espiões do console acumulam chamadas de um teste para o outro.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("logPlatformAction", () => {
  it("grava ator, clube, ação, detalhes e o primeiro IP do x-forwarded-for", async () => {
    await logPlatformAction({
      action: "club.set_status",
      club: CLUBE,
      details: { changes: { status: { from: "trial", to: "ativo" } } },
    });

    expect(h.inserted).toEqual([
      {
        table: "platform_audit_log",
        row: {
          actor_user_id: "u-1",
          actor_email: "dono@exemplo.com",
          action: "club.set_status",
          target_club_id: "c-1",
          target_club_name: "Clube Teste",
          details: { changes: { status: { from: "trial", to: "ativo" } } },
          ip: "203.0.113.7",
        },
      },
    ]);
  });

  it("ação sem clube grava clube nulo e IP nulo quando o cabeçalho falta", async () => {
    h.forwarded = null;
    await logPlatformAction({ action: "settings.update", details: { changes: {} } });
    expect(h.inserted[0]).toMatchObject({
      row: { target_club_id: null, target_club_name: null, ip: null },
    });
  });

  it("nunca grava segredo, mesmo que o chamador o passe", async () => {
    await logPlatformAction({
      action: "club.start_subscription",
      club: CLUBE,
      details: { asaas_api_key: "$aact_prod_segredo123456", amount_cents: 9900 },
    });
    const gravado = JSON.stringify(h.inserted);
    expect(gravado).not.toContain("segredo123456");
    expect(gravado).toContain("9900");
  });

  it("tabela ausente (migração 0072 pendente) vira aviso, não erro nem exceção", async () => {
    h.insertResult = { error: { code: "PGRST205", message: "Could not find the table" } };
    await expect(
      logPlatformAction({ action: "club.extend_trial", club: CLUBE, details: {} }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("falha de gravação vai para o log de erro e a ação principal segue", async () => {
    h.insertResult = { error: { code: "23514", message: "violação de restrição" } };
    await expect(
      logPlatformAction({ action: "club.extend_trial", club: CLUBE, details: {} }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("exceção inesperada (rede) também não escapa", async () => {
    h.insertThrows = true;
    await expect(
      logPlatformAction({ action: "club.extend_trial", club: CLUBE, details: {} }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("sem administrador na sessão não grava e avisa", async () => {
    h.actor = null;
    await logPlatformAction({ action: "club.extend_trial", club: CLUBE, details: {} });
    expect(h.inserted).toHaveLength(0);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("ação fora do formato entidade.verbo não chega ao banco", async () => {
    await logPlatformAction({ action: "Club-Update", details: {} });
    await logPlatformAction({ action: "club", details: {} });
    expect(h.inserted).toHaveLength(0);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("limita o tamanho do IP vindo do cabeçalho", async () => {
    h.forwarded = "x".repeat(500);
    await logPlatformAction({ action: "settings.update", details: {} });
    const row = (h.inserted[0] as { row: { ip: string } }).row;
    expect(row.ip).toHaveLength(64);
  });
});
