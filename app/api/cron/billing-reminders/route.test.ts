import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  operacoes: [] as Array<{ tabela: string; op: string; linha?: Record<string, unknown> }>,
  /** Resposta da leitura de cobranças, por ordem das janelas (prev, hoje, vencida). */
  cobrancas: [] as Array<{ data: unknown; error: { message: string } | null }>,
  leituras: 0,
  cronRunsQuebrado: false,
  push: [] as unknown[],
  emails: [] as unknown[],
  eventos: [] as Array<Record<string, unknown>>,
}));

function construtor(tabela: string) {
  let op = "select";
  let unica = false;
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (linha: Record<string, unknown>) => {
      op = "insert";
      estado.operacoes.push({ tabela, op, linha });
      return b;
    },
    update: (linha: Record<string, unknown>) => {
      op = "update";
      estado.operacoes.push({ tabela, op, linha });
      return b;
    },
    in: () => b,
    eq: () => b,
    single: () => {
      unica = true;
      return b;
    },
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      let resposta: unknown = { data: null, error: null };
      if (tabela === "cron_runs" && estado.cronRunsQuebrado) {
        resposta = { data: null, error: { message: 'relation "cron_runs" does not exist' } };
      } else if (tabela === "cron_runs" && op === "insert" && unica) resposta = { data: { id: 5 }, error: null };
      if (tabela === "athlete_charges") resposta = estado.cobrancas[estado.leituras++] ?? { data: [], error: null };
      return Promise.resolve(resposta).then(ok, ko);
    },
  };
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: construtor }) }));
vi.mock("@/lib/push/send", () => ({
  sendPushToAthlete: async (...args: unknown[]) => {
    estado.push.push(args);
  },
}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: async (...args: unknown[]) => {
    estado.emails.push(args);
  },
}));
vi.mock("@/lib/observability/record", () => ({
  recordSystemEvent: async (draft: Record<string, unknown>) => {
    estado.eventos.push(draft);
    return true;
  },
}));

import { GET } from "./route";

const cobranca = {
  id: "ch1",
  athlete_id: "a1",
  description: "Mensalidade",
  amount_cents: 10_000,
  discount_cents: 0,
  due_date: "2026-10-08",
  athletes: { full_name: "Atleta", guardian_email: "resp@x.com", is_active: true },
};

function chamar(autorizado = true) {
  return GET(
    new Request("https://vertice.app/api/cron/billing-reminders", {
      headers: autorizado ? { authorization: "Bearer segredo-do-teste" } : {},
    }),
  );
}

const fechamento = () => estado.operacoes.find((o) => o.tabela === "cron_runs" && o.op === "update");

beforeEach(() => {
  process.env.CRON_SECRET = "segredo-do-teste";
  estado.operacoes = [];
  estado.cobrancas = [];
  estado.leituras = 0;
  estado.cronRunsQuebrado = false;
  estado.push = [];
  estado.emails = [];
  estado.eventos = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/billing-reminders", () => {
  it("sem o segredo: 401 e nenhuma leitura", async () => {
    const r = await chamar(false);
    expect(r.status).toBe(401);
    expect(estado.operacoes).toHaveLength(0);
  });

  it("envia os lembretes como antes, com a MESMA resposta, e registra a execução como ok", async () => {
    estado.cobrancas = [
      { data: [], error: null },
      { data: [cobranca], error: null },
      { data: [], error: null },
    ];
    const r = await chamar();

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, enviados: 1 });
    expect(estado.push).toHaveLength(1);
    expect(estado.emails).toHaveLength(1);
    expect(fechamento()?.linha).toMatchObject({ ok: true, summary: { enviados: 1 } });
    expect(estado.eventos).toHaveLength(0);
  });

  it("erro ao ler uma janela: a resposta segue igual, mas a execução fica vermelha e a falha é registrada", async () => {
    estado.cobrancas = [
      { data: null, error: { message: "canceling statement due to statement timeout" } },
      { data: [cobranca], error: null },
      { data: [], error: null },
    ];
    const r = await chamar();

    // Regra de negócio intocada: a próxima janela é processada e o corpo é o de sempre.
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, enviados: 1 });

    expect(fechamento()?.linha).toMatchObject({ ok: false });
    expect(String(fechamento()?.linha?.error)).toContain("statement timeout");
    expect(estado.eventos).toHaveLength(1);
    expect(estado.eventos[0]).toMatchObject({
      source: "cron",
      severity: "error",
      route: "/api/cron/billing-reminders",
    });
  });

  it("telemetria quebrada (cron_runs indisponível) não impede o envio nem muda a resposta", async () => {
    estado.cronRunsQuebrado = true;
    estado.cobrancas = [
      { data: [cobranca], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await chamar();

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, enviados: 1 });
    expect(estado.push).toHaveLength(1);
    expect(estado.emails).toHaveLength(1);
  });
});
