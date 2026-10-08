import { beforeEach, describe, expect, it, vi } from "vitest";

// Garante que as nove ações do painel gravam a trilha de auditoria, com o
// nome certo, o clube certo e só os campos que mudaram, e que a trilha vem
// DEPOIS da mutação e só quando ela deu certo. Também que, quando a trilha
// não grava, a ação continua valendo mas a tela recebe o aviso.

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  events: [] as string[],
  logs: [] as { action: string; club?: { id: string; name: string | null }; details?: Record<string, unknown> }[],
  rows: {} as Record<string, unknown>,
  updateError: null as { message: string } | null,
  revalidated: 0,
  /** O que logPlatformAction devolve: true = gravou a trilha. */
  recorded: true,
  /** null = ASAAS_API_KEY ausente. */
  creds: { apiKey: "chave-de-teste", baseUrl: "https://asaas.test" } as { apiKey: string; baseUrl: string } | null,
  cancelFails: null as { message: string; status: number } | null,
}));

vi.mock("@/lib/platform/admin", () => ({
  requirePlatformAdmin: async () => ({ userId: "u-1", email: "dono@exemplo.com", fullName: "Dono" }),
}));
vi.mock("@/lib/platform/audit", () => ({
  logPlatformAction: async (entry: (typeof h.logs)[number]) => {
    h.events.push(`log:${entry.action}`);
    h.logs.push(entry);
    return h.recorded;
  },
}));
vi.mock("@/lib/platform/revalidate", () => ({
  revalidateAdmin: () => {
    h.revalidated += 1;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

// Cliente de serviço de mentira: select(...).eq(...).maybeSingle() devolve a
// linha configurada da tabela; update(...).eq(...) registra e responde.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      let op: "select" | "update" = "select";
      let patch: unknown;
      const api = {
        select: () => api,
        update: (p: unknown) => {
          op = "update";
          patch = p;
          return api;
        },
        eq: () => api,
        maybeSingle: async () => ({ data: h.rows[table] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          if (op === "update") h.events.push(`update:${table}:${JSON.stringify(patch)}`);
          return Promise.resolve({ error: h.updateError }).then(resolve, reject);
        },
      };
      return api;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "responsavel@exemplo.com" } } }) } },
  }),
}));

vi.mock("@/lib/asaas/platform", () => ({
  getPlatformAsaasCredentials: () => h.creds,
}));
vi.mock("@/lib/asaas/client", () => {
  class AsaasError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    AsaasError,
    findCustomerByCpf: async () => null,
    createCustomer: async () => ({ id: "cus_novo" }),
    createSubscription: async () => ({ id: "sub_123" }),
    cancelSubscription: async () => {
      h.events.push("asaas:cancel");
      if (h.cancelFails) throw new AsaasError(h.cancelFails.message, h.cancelFails.status);
    },
    getSubscriptionPaymentLink: async () => "https://pay.test/abc",
  };
});

import {
  extendTrial,
  grantCourtesy,
  resetPaymentPromise,
  revokeCourtesy,
  setClubOverrides,
  setClubStatus,
  updatePlatformSettings,
} from "./platformAdmin";
import { cancelClubSubscription, startClubSubscription } from "./platformBilling";
import { AUDIT_NOT_RECORDED_WARNING } from "@/lib/platform/auditNotice";

const CLUB_ID = "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f";

const clubBase = {
  id: CLUB_ID,
  name: "Clube Teste",
  status: "trial",
  trial_ends_at: "2026-01-01T23:59:59+00:00",
  courtesy_until: null,
  courtesy_reason: null,
  max_athletes_override: null,
  price_cents_override: null,
  payment_promise_used_at: null,
  canceled_at: null,
};

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.events = [];
  h.logs = [];
  h.rows = { clubs: { ...clubBase } };
  h.updateError = null;
  h.revalidated = 0;
  h.recorded = true;
  h.creds = { apiKey: "chave-de-teste", baseUrl: "https://asaas.test" };
  h.cancelFails = null;
});

describe("trilha das ações do painel", () => {
  it("settings.update registra só o que mudou", async () => {
    h.rows = {
      platform_settings: {
        plan_name: "Pro",
        price_cents: 14990,
        trial_days: 15,
        max_athletes: 30,
        retention_days: 90,
      },
    };
    const result = await updatePlatformSettings(
      form({ planName: "Pro", priceReais: "199,90", trialDays: "15", maxAthletes: "30", retentionDays: "90" }),
    );
    expect(result).toEqual({ success: true });
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0].action).toBe("settings.update");
    expect(h.logs[0].club).toBeUndefined();
    expect(h.logs[0].details).toEqual({ changes: { price_cents: { from: 14990, to: 19990 } } });
    expect(h.revalidated).toBe(1);
  });

  it("settings.update sem mudança não polui a trilha", async () => {
    h.rows = {
      platform_settings: {
        plan_name: "Pro",
        price_cents: 14990,
        trial_days: 15,
        max_athletes: 30,
        retention_days: 90,
      },
    };
    await updatePlatformSettings(
      form({ planName: "Pro", priceReais: "149,90", trialDays: "15", maxAthletes: "30", retentionDays: "90" }),
    );
    expect(h.logs).toHaveLength(0);
  });

  it("club.extend_trial registra dias, situação e novo prazo", async () => {
    h.rows = { clubs: { ...clubBase, status: "ativo", trial_ends_at: null } };
    expect(await extendTrial(form({ clubId: CLUB_ID, dias: "15" }))).toEqual({ success: true });
    const log = h.logs[0];
    expect(log.action).toBe("club.extend_trial");
    expect(log.club).toEqual({ id: CLUB_ID, name: "Clube Teste" });
    expect(log.details?.dias).toBe(15);
    const changes = log.details?.changes as Record<string, { from: unknown; to: unknown }>;
    expect(changes.status).toEqual({ from: "ativo", to: "trial" });
    expect(changes.trial_ends_at.from).toBeNull();
    expect(String(changes.trial_ends_at.to)).toMatch(/T23:59:59Z$/);
  });

  it("club.grant_courtesy registra prazo e motivo", async () => {
    await grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31", motivo: "parceria" }));
    expect(h.logs[0].action).toBe("club.grant_courtesy");
    expect(h.logs[0].details).toEqual({
      changes: {
        courtesy_until: { from: null, to: "2026-12-31T23:59:59Z" },
        courtesy_reason: { from: null, to: "parceria" },
      },
    });
  });

  it("club.revoke_courtesy registra o que foi removido", async () => {
    h.rows = {
      clubs: { ...clubBase, courtesy_until: "2026-12-31T23:59:59+00:00", courtesy_reason: "parceria" },
    };
    await revokeCourtesy(form({ clubId: CLUB_ID }));
    expect(h.logs[0].action).toBe("club.revoke_courtesy");
    expect(h.logs[0].details).toEqual({
      changes: {
        courtesy_until: { from: "2026-12-31T23:59:59+00:00", to: null },
        courtesy_reason: { from: "parceria", to: null },
      },
    });
  });

  it("club.reset_payment_promise registra a devolução", async () => {
    h.rows = { clubs: { ...clubBase, payment_promise_used_at: "2026-09-01T10:00:00+00:00" } };
    await resetPaymentPromise(form({ clubId: CLUB_ID }));
    expect(h.logs[0].action).toBe("club.reset_payment_promise");
    expect(h.logs[0].details).toEqual({
      changes: { payment_promise_used_at: { from: "2026-09-01T10:00:00+00:00", to: null } },
    });
  });

  it("club.set_overrides registra cota e preço novos; sem mudança não registra", async () => {
    await setClubOverrides(form({ clubId: CLUB_ID, maxAthletes: "50", priceReais: "99,00" }));
    expect(h.logs[0].action).toBe("club.set_overrides");
    expect(h.logs[0].details).toEqual({
      changes: {
        max_athletes_override: { from: null, to: 50 },
        price_cents_override: { from: null, to: 9900 },
      },
    });

    h.logs = [];
    await setClubOverrides(form({ clubId: CLUB_ID, maxAthletes: "", priceReais: "" }));
    expect(h.logs).toHaveLength(0);
  });

  it("club.set_status registra a mudança de situação e a data de cancelamento", async () => {
    h.rows = { clubs: { ...clubBase, status: "ativo", trial_ends_at: null } };
    await setClubStatus(form({ clubId: CLUB_ID, status: "cancelado" }));
    expect(h.logs[0].action).toBe("club.set_status");
    const changes = h.logs[0].details?.changes as Record<string, { from: unknown; to: unknown }>;
    expect(changes.status).toEqual({ from: "ativo", to: "cancelado" });
    expect(changes.canceled_at.from).toBeNull();
    expect(changes.canceled_at.to).toEqual(expect.any(String));
    expect(changes.trial_ends_at).toBeUndefined();
  });

  it("club.start_subscription registra a cobrança sem CPF, link nem chave", async () => {
    h.rows = {
      clubs: { ...clubBase, owner_profile_id: "owner-1", asaas_customer_id: null },
      profiles: { full_name: "Responsável" },
    };
    const result = await startClubSubscription(
      form({ clubId: CLUB_ID, cpfCnpj: "123.456.789-09", amountReais: "149,90", billingType: "PIX" }),
    );
    expect(result).toEqual({ success: true });
    const log = h.logs[0];
    expect(log.action).toBe("club.start_subscription");
    expect(log.club).toEqual({ id: CLUB_ID, name: "Clube Teste" });
    expect(log.details).toEqual({
      billing_type: "PIX",
      amount_cents: 14990,
      asaas_subscription_id: "sub_123",
      customer: "novo",
    });
    const texto = JSON.stringify(log);
    expect(texto).not.toContain("12345678909");
    expect(texto).not.toContain("pay.test");
    expect(texto).not.toContain("chave-de-teste");
  });

  it("club.cancel_subscription registra o retorno do Asaas", async () => {
    h.rows = { clubs: { ...clubBase, asaas_subscription_id: "sub_123" } };
    expect(await cancelClubSubscription(form({ clubId: CLUB_ID }))).toEqual({ success: true });
    expect(h.logs[0].action).toBe("club.cancel_subscription");
    expect(h.logs[0].details).toEqual({ asaas_subscription_id: "sub_123", asaas: "cancelada" });
  });

  it("a trilha é gravada DEPOIS da mutação", async () => {
    await grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31" }));
    const iUpdate = h.events.findIndex((e) => e.startsWith("update:clubs"));
    const iLog = h.events.findIndex((e) => e === "log:club.grant_courtesy");
    expect(iUpdate).toBeGreaterThanOrEqual(0);
    expect(iLog).toBeGreaterThan(iUpdate);
  });

  it("mutação que falhou não deixa rastro de sucesso na trilha", async () => {
    h.updateError = { message: "falha no banco" };
    const result = await grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31" }));
    expect(result).toEqual({ error: "falha no banco" });
    expect(h.logs).toHaveLength(0);
    expect(h.revalidated).toBe(0);
  });

  it("clube inexistente dá erro em vez de sucesso falso, sem trilha", async () => {
    h.rows = {};
    for (const run of [
      () => extendTrial(form({ clubId: CLUB_ID, dias: "15" })),
      () => grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31" })),
      () => revokeCourtesy(form({ clubId: CLUB_ID })),
      () => resetPaymentPromise(form({ clubId: CLUB_ID })),
      () => setClubOverrides(form({ clubId: CLUB_ID, maxAthletes: "5", priceReais: "" })),
      () => setClubStatus(form({ clubId: CLUB_ID, status: "bloqueado" })),
      () => cancelClubSubscription(form({ clubId: CLUB_ID })),
    ]) {
      expect(await run()).toEqual({ error: "Clube não encontrado." });
    }
    expect(h.logs).toHaveLength(0);
    expect(h.events.some((e) => e.startsWith("update:"))).toBe(false);
  });

  it("club.cancel_subscription sem ASAAS_API_KEY não cancela nada e devolve erro", async () => {
    h.rows = {
      clubs: { ...clubBase, asaas_subscription_id: "sub_123", asaas_checkout_url: "https://pay.test/abc" },
    };
    h.creds = null;
    const result = await cancelClubSubscription(form({ clubId: CLUB_ID }));
    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/ASAAS_API_KEY/);
    // Nem o link de pagamento é apagado, nem a trilha ganha uma linha de algo que não houve.
    expect(h.events.some((e) => e.startsWith("update:"))).toBe(false);
    expect(h.events).not.toContain("asaas:cancel");
    expect(h.logs).toHaveLength(0);
    expect(h.revalidated).toBe(0);
  });

  it("club.cancel_subscription sem assinatura segue sem precisar da chave", async () => {
    h.rows = { clubs: { ...clubBase, asaas_subscription_id: null } };
    h.creds = null;
    expect(await cancelClubSubscription(form({ clubId: CLUB_ID }))).toEqual({ success: true });
    expect(h.logs[0].details).toEqual({ asaas_subscription_id: null, asaas: "sem_assinatura" });
  });

  it("club.cancel_subscription: 404 do Asaas conta como já cancelada; outro erro aborta", async () => {
    h.rows = { clubs: { ...clubBase, asaas_subscription_id: "sub_123" } };

    h.cancelFails = { message: "não existe", status: 404 };
    expect(await cancelClubSubscription(form({ clubId: CLUB_ID }))).toEqual({ success: true });
    expect(h.logs[0].details).toEqual({ asaas_subscription_id: "sub_123", asaas: "nao_encontrada" });

    h.logs = [];
    h.events = [];
    h.cancelFails = { message: "Asaas fora do ar", status: 500 };
    expect(await cancelClubSubscription(form({ clubId: CLUB_ID }))).toEqual({ error: "Asaas fora do ar" });
    expect(h.events.some((e) => e.startsWith("update:"))).toBe(false);
    expect(h.logs).toHaveLength(0);
  });
});

describe("aviso quando a trilha não grava", () => {
  const acoes: [string, () => Promise<{ success?: boolean; error?: string; warning?: string }>, Record<string, unknown>][] = [
    ["settings.update", () => updatePlatformSettings(form({ planName: "Pro", priceReais: "199,90", trialDays: "15", maxAthletes: "30", retentionDays: "90" })), {
      platform_settings: { plan_name: "Pro", price_cents: 14990, trial_days: 15, max_athletes: 30, retention_days: 90 },
    }],
    ["club.extend_trial", () => extendTrial(form({ clubId: CLUB_ID, dias: "15" })), { clubs: { ...clubBase } }],
    ["club.grant_courtesy", () => grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31" })), { clubs: { ...clubBase } }],
    ["club.revoke_courtesy", () => revokeCourtesy(form({ clubId: CLUB_ID })), {
      clubs: { ...clubBase, courtesy_until: "2026-12-31T23:59:59+00:00" },
    }],
    ["club.reset_payment_promise", () => resetPaymentPromise(form({ clubId: CLUB_ID })), {
      clubs: { ...clubBase, payment_promise_used_at: "2026-09-01T10:00:00+00:00" },
    }],
    ["club.set_overrides", () => setClubOverrides(form({ clubId: CLUB_ID, maxAthletes: "50", priceReais: "" })), { clubs: { ...clubBase } }],
    ["club.set_status", () => setClubStatus(form({ clubId: CLUB_ID, status: "bloqueado" })), { clubs: { ...clubBase } }],
    ["club.start_subscription", () => startClubSubscription(form({ clubId: CLUB_ID, cpfCnpj: "123.456.789-09", amountReais: "149,90", billingType: "PIX" })), {
      clubs: { ...clubBase, owner_profile_id: "owner-1", asaas_customer_id: null },
      profiles: { full_name: "Responsável" },
    }],
    ["club.cancel_subscription", () => cancelClubSubscription(form({ clubId: CLUB_ID })), {
      clubs: { ...clubBase, asaas_subscription_id: "sub_123" },
    }],
  ];

  it.each(acoes)("%s: a ação vale, mas a tela é avisada", async (nome, run, rows) => {
    h.rows = rows;
    h.recorded = false;
    const result = await run();
    expect(result).toEqual({ success: true, warning: AUDIT_NOT_RECORDED_WARNING });
    expect(h.logs.map((l) => l.action)).toEqual([nome]);
    expect(h.revalidated).toBe(1);
  });

  it.each(acoes)("%s: trilha gravada não traz aviso", async (_nome, run, rows) => {
    h.rows = rows;
    expect(await run()).toEqual({ success: true });
  });

  it("ação que não mudou nada não tem o que registrar nem o que avisar", async () => {
    h.recorded = false;
    h.rows = {
      platform_settings: { plan_name: "Pro", price_cents: 14990, trial_days: 15, max_athletes: 30, retention_days: 90 },
    };
    expect(
      await updatePlatformSettings(
        form({ planName: "Pro", priceReais: "149,90", trialDays: "15", maxAthletes: "30", retentionDays: "90" }),
      ),
    ).toEqual({ success: true });

    h.rows = { clubs: { ...clubBase } };
    expect(await setClubOverrides(form({ clubId: CLUB_ID, maxAthletes: "", priceReais: "" }))).toEqual({
      success: true,
    });
    expect(h.logs).toHaveLength(0);
  });

  it("falha da mutação continua sendo erro, sem aviso de auditoria", async () => {
    h.recorded = false;
    h.updateError = { message: "falha no banco" };
    expect(await grantCourtesy(form({ clubId: CLUB_ID, ate: "2026-12-31" }))).toEqual({
      error: "falha no banco",
    });
  });
});
