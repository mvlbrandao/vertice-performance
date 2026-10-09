import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const estado = vi.hoisted(() => ({
  insert: undefined as undefined | ((row: Record<string, unknown>) => unknown),
  linhas: [] as Record<string, unknown>[],
  criar: undefined as undefined | (() => unknown),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (estado.criar) return estado.criar();
    return {
      from: (tabela: string) => {
        if (tabela !== "system_events") throw new Error(`tabela inesperada: ${tabela}`);
        return {
          insert: (row: Record<string, unknown>) => {
            estado.linhas.push(row);
            return estado.insert ? estado.insert(row) : Promise.resolve({ error: null });
          },
        };
      },
    };
  },
}));

import type { SystemEventDraft } from "./capture";
import { MAX_EVENTS_PER_FINGERPRINT_PER_MINUTE, RECORD_TIMEOUT_MS, recordSystemEvent } from "./record";

function rascunho(extra: Partial<SystemEventDraft> = {}): SystemEventDraft {
  return {
    source: "route",
    severity: "error",
    route: "/athletes/42/dados",
    method: "GET",
    statusCode: null,
    durationMs: null,
    message: "falha qualquer",
    digest: "12345",
    clubId: null,
    ...extra,
  };
}

beforeEach(() => {
  estado.insert = undefined;
  estado.linhas = [];
  estado.criar = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("recordSystemEvent", () => {
  it("grava só os campos esperados, com mensagem e rota limpas e a impressão digital", async () => {
    const ok = await recordSystemEvent(
      rascunho({ message: "erro para ana@clube.com", route: "/athletes/8f14e45f-ceea-467a-9575-0a1b2c3d4e5f?x=1" }),
    );
    expect(ok).toBe(true);
    expect(estado.linhas).toHaveLength(1);
    const linha = estado.linhas[0];
    expect(linha).toMatchObject({
      severity: "error",
      source: "route",
      route: "/athletes/:id",
      method: "GET",
      message: "erro para [email]",
      digest: "12345",
      club_id: null,
    });
    expect(linha.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    // Nada de cabeçalho, cookie, corpo nem usuário: só estas colunas existem.
    expect(Object.keys(linha).sort()).toEqual(
      [
        "club_id",
        "digest",
        "duration_ms",
        "fingerprint",
        "message",
        "method",
        "route",
        "severity",
        "source",
        "status_code",
      ].sort(),
    );
  });

  it("a mesma falha com ids diferentes cai na mesma impressão digital", async () => {
    await recordSystemEvent(rascunho({ message: "timeout no job 111111111", route: "/a/1" }), { bypassLimiter: true });
    await recordSystemEvent(rascunho({ message: "timeout no job 222222222", route: "/a/2" }), { bypassLimiter: true });
    expect(estado.linhas[0].fingerprint).toBe(estado.linhas[1].fingerprint);
  });

  it("limita gravações por impressão digital por minuto (falha em laço não inunda o banco)", async () => {
    let gravadas = 0;
    for (let i = 0; i < 40; i++) {
      if (await recordSystemEvent(rascunho({ message: "falha em laço única do teste" }))) gravadas += 1;
    }
    expect(gravadas).toBe(MAX_EVENTS_PER_FINGERPRINT_PER_MINUTE);
    expect(estado.linhas).toHaveLength(MAX_EVENTS_PER_FINGERPRINT_PER_MINUTE);
  });

  it("bypassLimiter ignora o teto (quem tem teto próprio, como o cron)", async () => {
    for (let i = 0; i < 12; i++) {
      await recordSystemEvent(rascunho({ message: "falha do cron com teto próprio" }), { bypassLimiter: true });
    }
    expect(estado.linhas).toHaveLength(12);
  });

  it("clube só vai se for UUID; status e duração fora da faixa viram null", async () => {
    await recordSystemEvent(
      rascunho({ message: "m1", clubId: "não-é-uuid", statusCode: 999, durationMs: -5 }),
      { bypassLimiter: true },
    );
    await recordSystemEvent(
      rascunho({
        message: "m2",
        clubId: "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f",
        statusCode: 409,
        durationMs: 1234.6,
      }),
      { bypassLimiter: true },
    );
    expect(estado.linhas[0]).toMatchObject({ club_id: null, status_code: null, duration_ms: null });
    expect(estado.linhas[1]).toMatchObject({
      club_id: "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f",
      status_code: 409,
      duration_ms: 1235,
    });
  });

  it("erro devolvido pelo banco vira false, nunca exceção", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    estado.insert = () => Promise.resolve({ error: { message: "relation does not exist" } });
    await expect(recordSystemEvent(rascunho({ message: "e1" }), { bypassLimiter: true })).resolves.toBe(false);
  });

  it("insert que lança de forma síncrona também não propaga", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    estado.insert = () => {
      throw new Error("boom síncrono");
    };
    await expect(recordSystemEvent(rascunho({ message: "e2" }), { bypassLimiter: true })).resolves.toBe(false);
  });

  it("client que não consegue ser criado (chave ausente) não propaga", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    estado.criar = () => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
    };
    await expect(recordSystemEvent(rascunho({ message: "e3" }), { bypassLimiter: true })).resolves.toBe(false);
  });

  it("banco pendurado: desiste em 2 s e devolve false", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    estado.insert = () => new Promise(() => {});
    const promessa = recordSystemEvent(rascunho({ message: "e4" }), { bypassLimiter: true });
    await vi.advanceTimersByTimeAsync(RECORD_TIMEOUT_MS);
    await expect(promessa).resolves.toBe(false);
  });

  it("rascunho malformado não lança", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      recordSystemEvent(null as unknown as SystemEventDraft, { bypassLimiter: true }),
    ).resolves.toBe(false);
  });
});
