import { describe, expect, it, vi } from "vitest";
import {
  TELEMETRY_KEEP_DAYS,
  classifyPruneResult,
  isMissingFunction,
  pruneTelemetry,
  type PruneClient,
} from "./prune";

function clienteCom(resposta: unknown): { client: PruneClient; rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn(async () => resposta);
  return { client: { rpc } as unknown as PruneClient, rpc };
}

describe("isMissingFunction", () => {
  it("reconhece o erro do PostgREST (PGRST202) e do Postgres (42883)", () => {
    expect(isMissingFunction({ code: "PGRST202", message: "x" })).toBe(true);
    expect(isMissingFunction({ code: "42883", message: "x" })).toBe(true);
  });

  it("reconhece pela mensagem quando o código não vem", () => {
    expect(
      isMissingFunction({
        message: "Could not find the function public.platform_prune_telemetry(p_keep_days) in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingFunction({ message: "function platform_prune_telemetry(integer) does not exist" })).toBe(true);
  });

  it("outros erros e a ausência de erro não contam", () => {
    expect(isMissingFunction({ code: "23503", message: "foreign key" })).toBe(false);
    expect(isMissingFunction({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
    expect(isMissingFunction(undefined)).toBe(false);
  });
});

describe("classifyPruneResult", () => {
  it("função ausente é 'pendente', não falha", () => {
    expect(classifyPruneResult({ data: null, error: { code: "PGRST202", message: "x" } })).toEqual({
      status: "pendente",
    });
  });

  it("outro erro é 'falhou' e a mensagem sai sanitizada", () => {
    const out = classifyPruneResult({
      data: null,
      error: { code: "XX000", message: "falha para ana@x.com" },
    });
    expect(out.status).toBe("falhou");
    expect(out.message).not.toContain("ana@x.com");
  });

  it("sucesso devolve a contagem do que foi apagado", () => {
    expect(
      classifyPruneResult({ data: { system_events: 3, web_vitals: 10, cron_runs: 1 }, error: null }),
    ).toEqual({ status: "ok", removed: { system_events: 3, web_vitals: 10, cron_runs: 1 } });
  });

  it("sucesso sem objeto de contagem continua ok", () => {
    expect(classifyPruneResult({ data: null, error: null })).toEqual({ status: "ok" });
    expect(classifyPruneResult({ data: [1, 2], error: null })).toEqual({ status: "ok" });
  });
});

describe("pruneTelemetry", () => {
  it("chama platform_prune_telemetry com 30 dias por padrão", async () => {
    const { client, rpc } = clienteCom({ data: {}, error: null });
    await pruneTelemetry(client);
    expect(TELEMETRY_KEEP_DAYS).toBe(30);
    expect(rpc).toHaveBeenCalledWith("platform_prune_telemetry", { p_keep_days: 30 });
  });

  it("tolera a função ausente (PGRST202): pendente, sem lançar", async () => {
    const { client } = clienteCom({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.platform_prune_telemetry" },
    });
    await expect(pruneTelemetry(client)).resolves.toEqual({ status: "pendente" });
  });

  it("tolera a função ausente (42883): pendente", async () => {
    const { client } = clienteCom({ data: null, error: { code: "42883", message: "undefined_function" } });
    await expect(pruneTelemetry(client)).resolves.toEqual({ status: "pendente" });
  });

  it("erro de rede vira 'falhou', não exceção", async () => {
    const client = {
      rpc: () => {
        throw new Error("fetch failed");
      },
    } as unknown as PruneClient;
    await expect(pruneTelemetry(client)).resolves.toEqual({ status: "falhou", message: "fetch failed" });
  });
});
