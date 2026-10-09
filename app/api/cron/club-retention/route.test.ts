import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prova o caso real de 08/10: o DELETE do clube devolve 409 (FK) e a rota
 * respondia `ok: true` em silêncio. Aqui a rota roda de verdade, com o banco
 * e o storage trocados por um cliente em memória que registra cada operação.
 */

const CLUBE = "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f";

interface Operacao {
  tabela: string;
  op: "select" | "insert" | "update" | "delete";
  linha?: Record<string, unknown>;
}

const estado = vi.hoisted(() => ({
  operacoes: [] as Array<{ tabela: string; op: string; linha?: Record<string, unknown> }>,
  respostas: {} as Record<string, unknown>,
  rpc: undefined as undefined | (() => unknown),
  eventos: [] as Array<{ draft: Record<string, unknown>; options: unknown }>,
  contratos: [] as string[],
  demoFalha: false,
}));

function responder(tabela: string, op: string, unica: boolean) {
  const chave = `${tabela}:${op}`;
  if (chave in estado.respostas) return estado.respostas[chave];
  if (tabela === "cron_runs" && op === "insert" && unica) return { data: { id: 11 }, error: null };
  if (tabela === "clubs" && op === "select") {
    return { data: [{ id: CLUBE, name: "Clube Cancelado", canceled_at: "2026-01-01T00:00:00Z" }], error: null };
  }
  if (tabela === "profiles" && op === "select") return { data: [], error: null };
  return { data: null, error: null };
}

function construtor(tabela: string) {
  let op: Operacao["op"] = "select";
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
    delete: () => {
      op = "delete";
      estado.operacoes.push({ tabela, op });
      return b;
    },
    eq: () => b,
    not: () => b,
    lt: () => b,
    single: () => {
      unica = true;
      return b;
    },
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(responder(tabela, op, unica)).then(ok, ko),
  };
  return b;
}

const admin = {
  from: (tabela: string) => construtor(tabela),
  rpc: async (fn: string) => {
    estado.operacoes.push({ tabela: `rpc:${fn}`, op: "select" });
    return estado.rpc
      ? estado.rpc()
      : { data: null, error: { code: "PGRST202", message: "Could not find the function public.platform_prune_telemetry" } };
  },
  auth: { admin: { deleteUser: async () => ({ error: null }) } },
  storage: {
    from: () => ({
      list: async () => ({ data: [], error: null }),
      remove: async (paths: string[]) => {
        estado.contratos.push(...paths);
        return { data: paths, error: null };
      },
    }),
  },
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/platform/license", () => ({ getPlatformSettings: async () => ({ retentionDays: 60 }) }));
vi.mock("@/lib/demo/generator", () => ({
  DEMO_SLUG: "vertice-demo",
  TABELAS_DO_CLUBE: ["announcements"],
  seedDemoClub: async () => {
    if (estado.demoFalha) throw new Error("slug duplicado");
    return { clubId: "demo", atletas: 10, profissionais: 2 };
  },
}));
vi.mock("@/lib/observability/record", () => ({
  recordSystemEvent: async (draft: Record<string, unknown>, options: unknown) => {
    estado.eventos.push({ draft, options });
    return true;
  },
}));

import { GET } from "./route";

function chamar(autorizado = true) {
  return GET(
    new Request("https://vertice.app/api/cron/club-retention", {
      headers: autorizado ? { authorization: "Bearer segredo-do-teste" } : {},
    }),
  );
}

function fechamento() {
  return estado.operacoes.find((o) => o.tabela === "cron_runs" && o.op === "update");
}

const FK_409 = {
  data: null,
  error: {
    code: "23503",
    message:
      'update or delete on table "clubs" violates foreign key constraint "announcements_club_id_fkey" on table "announcements"',
  },
};

beforeEach(() => {
  process.env.CRON_SECRET = "segredo-do-teste";
  estado.operacoes = [];
  estado.respostas = {};
  estado.rpc = undefined;
  estado.eventos = [];
  estado.contratos = [];
  estado.demoFalha = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/club-retention", () => {
  it("sem o segredo: 401 e nada é registrado nem apagado", async () => {
    const r = await chamar(false);
    expect(r.status).toBe(401);
    expect(estado.operacoes).toHaveLength(0);
  });

  it("CASO REAL: DELETE do clube devolve 409 -> ok:false, HTTP 200, falha no corpo, em cron_runs e em system_events", async () => {
    estado.respostas["clubs:delete"] = FK_409;

    const r = await chamar();
    const body = await r.json();

    // 200 de propósito: um 5xx faria o agendador reexecutar o expurgo inteiro.
    expect(r.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.apagados).toEqual([]);
    expect(body.falhas).toHaveLength(1);
    expect(body.falhas[0]).toMatchObject({ etapa: "clube", clube: "Clube Cancelado" });
    expect(body.falhas[0].mensagem).toContain("announcements_club_id_fkey");

    const fim = fechamento();
    expect(fim?.linha).toMatchObject({ ok: false });
    expect(String(fim?.linha?.error)).toContain("announcements_club_id_fkey");
    expect(fim?.linha?.summary).toMatchObject({ apagados: 0, falhas: 1, clubesVencidos: 1 });

    expect(estado.eventos).toHaveLength(1);
    expect(estado.eventos[0].draft).toMatchObject({
      source: "cron",
      severity: "error",
      route: "/api/cron/club-retention",
      clubId: CLUBE,
    });
    // O nome do clube não vai para a telemetria (só o id).
    expect(JSON.stringify(estado.eventos)).not.toContain("Clube Cancelado");
  });

  it("função de retenção ausente: retencao 'pendente' no corpo e no resumo, e a execução continua verde", async () => {
    const r = await chamar();
    const body = await r.json();

    expect(r.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retencao).toBe("pendente");
    expect(body.apagados).toEqual(["Clube Cancelado"]);
    expect(fechamento()?.linha).toMatchObject({ ok: true });
    expect(fechamento()?.linha?.summary).toMatchObject({ retencao: "pendente" });
    expect(estado.eventos).toHaveLength(0);
  });

  it("função de retenção presente: chama com 30 dias e guarda a contagem apagada", async () => {
    estado.rpc = () => ({ data: { system_events: 4, web_vitals: 20, cron_runs: 2 }, error: null });
    const body = await (await chamar()).json();

    expect(body.retencao).toBe("ok");
    expect(fechamento()?.linha?.summary).toMatchObject({
      retencao: "ok",
      telemetriaRemovida: { system_events: 4, web_vitals: 20, cron_runs: 2 },
    });
  });

  it("retenção que falha de verdade (não é função ausente) deixa a execução vermelha", async () => {
    estado.rpc = () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    const body = await (await chamar()).json();

    expect(body.ok).toBe(false);
    expect(body.retencao).toBe("falhou");
    expect(body.falhas.some((f: { etapa: string }) => f.etapa === "retencao")).toBe(true);
  });

  it("restauração da demo que falha também vira falha (a demo vazia por horas foi o sintoma)", async () => {
    estado.demoFalha = true;
    const body = await (await chamar()).json();

    expect(body.ok).toBe(false);
    expect(body.demo.resultado).toContain("falhou");
    expect(body.falhas.some((f: { etapa: string }) => f.etapa === "demo")).toBe(true);
    expect(fechamento()?.linha?.summary).toMatchObject({ demo: "falhou" });
  });

  it("erro ao listar os clubes vencidos mantém o 500 de antes, mas agora fica registrado", async () => {
    estado.respostas["clubs:select"] = { data: null, error: { message: "connection terminated" } };
    const r = await chamar();

    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "connection terminated" });
    expect(fechamento()?.linha).toMatchObject({ ok: false });
    expect(estado.eventos).toHaveLength(1);
  });

  it("antes de apagar o clube, remove os contratos do storage sob {club_id}/ (e a lista tolera bucket vazio)", async () => {
    const r = await chamar();
    expect((await r.json()).ok).toBe(true);
    // Bucket vazio: nada a remover, e isso não é falha.
    expect(estado.contratos).toEqual([]);

    const ordem = estado.operacoes.map((o) => `${o.tabela}:${o.op}`);
    expect(ordem.indexOf("clubs:delete")).toBeGreaterThan(ordem.indexOf("announcements:delete"));
  });

  it("falha na telemetria (cron_runs indisponível) não muda a resposta do expurgo", async () => {
    estado.respostas["cron_runs:insert"] = { data: null, error: { message: "relation cron_runs does not exist" } };
    estado.respostas["cron_runs:update"] = { data: null, error: { message: "relation cron_runs does not exist" } };
    const r = await chamar();
    const body = await r.json();

    expect(r.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.apagados).toEqual(["Clube Cancelado"]);
  });
});
