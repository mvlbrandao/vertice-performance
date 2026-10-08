import { describe, expect, it } from "vitest";
import { REDACTED, normalizeAuditDetails } from "./auditDetails";

describe("normalizeAuditDetails", () => {
  it("passa dados comuns sem alterar", () => {
    const input = {
      dias: 15,
      changes: { status: { from: "trial", to: "ativo" } },
      reused: false,
      nada: null,
    };
    expect(normalizeAuditDetails(input)).toEqual(input);
  });

  it("devolve objeto vazio para ausência", () => {
    expect(normalizeAuditDetails(undefined)).toEqual({});
    expect(normalizeAuditDetails(null)).toEqual({});
  });

  it("embrulha valor solto em { valor }", () => {
    expect(normalizeAuditDetails("oi")).toEqual({ valor: "oi" });
    expect(normalizeAuditDetails([1, 2])).toEqual({ valor: [1, 2] });
  });

  it("remove undefined e funções, e troca NaN por null", () => {
    expect(
      normalizeAuditDetails({ a: undefined, b: () => 1, c: Number.NaN, d: Infinity, e: 1 }),
    ).toEqual({ c: null, d: null, e: 1 });
  });

  it("converte Date em ISO e bigint em texto", () => {
    expect(normalizeAuditDetails({ quando: new Date("2026-10-08T15:00:00Z"), n: BigInt(10) })).toEqual({
      quando: "2026-10-08T15:00:00.000Z",
      n: "10",
    });
  });

  it("omite campos com nome de credencial, em qualquer nível", () => {
    const out = normalizeAuditDetails({
      asaas_api_key: "$aact_prod_abc123def456",
      webhook_token: "xyz",
      senha: "123",
      Authorization: "Bearer abc",
      cookie: "sb=1",
      CREDENTIALS_ENCRYPTION_KEY: "k",
      service_role: "r",
      nested: { api_key: "k", ok: "visivel" },
      changes: { asaas_api_key: { from: "velha", to: "nova" } },
    });
    expect(out.asaas_api_key).toBe(REDACTED);
    expect(out.webhook_token).toBe(REDACTED);
    expect(out.senha).toBe(REDACTED);
    expect(out.Authorization).toBe(REDACTED);
    expect(out.cookie).toBe(REDACTED);
    expect(out.CREDENTIALS_ENCRYPTION_KEY).toBe(REDACTED);
    expect(out.service_role).toBe(REDACTED);
    expect(out.nested).toEqual({ api_key: REDACTED, ok: "visivel" });
    expect(out.changes).toEqual({ asaas_api_key: REDACTED });
    expect(JSON.stringify(out)).not.toContain("velha");
    expect(JSON.stringify(out)).not.toContain("aact_prod");
  });

  it("não confunde campos comuns com credencial", () => {
    const input = {
      price_cents: 100,
      trial_ends_at: "x",
      courtesy_reason: "parceria",
      max_athletes_override: 3,
      asaas_subscription_id: "sub_1",
    };
    expect(normalizeAuditDetails(input)).toEqual(input);
  });

  it("censura valor com cara de chave mesmo em campo de nome inocente", () => {
    const out = normalizeAuditDetails({
      motivo: "usei a chave $aact_hmlg_000AAABBBCCC111 na troca",
      erro: "falhou com Bearer abcdefgh12345678",
      jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk",
    });
    const texto = JSON.stringify(out);
    expect(texto).not.toContain("aact_hmlg");
    expect(texto).not.toContain("abcdefgh12345678");
    expect(texto).not.toContain("eyJhbGci");
    expect(texto).toContain(REDACTED);
  });

  it("corta texto muito longo", () => {
    const out = normalizeAuditDetails({ msg: "a".repeat(2000) });
    expect((out.msg as string).length).toBeLessThanOrEqual(501);
    expect((out.msg as string).endsWith("…")).toBe(true);
  });

  it("limita profundidade e tamanho de lista", () => {
    let fundo: Record<string, unknown> = { fim: true };
    for (let i = 0; i < 20; i++) fundo = { n: fundo };
    expect(JSON.stringify(normalizeAuditDetails(fundo))).toContain("profundo demais");

    const out = normalizeAuditDetails({ lista: Array.from({ length: 500 }, (_, i) => i) });
    expect((out.lista as number[]).length).toBe(50);
  });

  it("troca por um resumo quando o conjunto estoura o limite", () => {
    const muito: Record<string, unknown> = {};
    for (let i = 0; i < 60; i++) muito[`campo${i}`] = "x".repeat(400);
    const out = normalizeAuditDetails(muito);
    expect(out.truncado).toBe(true);
    expect(Array.isArray(out.campos)).toBe(true);
  });

  it("instância de classe vira texto curto em vez de despejar campos", () => {
    class Segredo {
      valor = "interno";
    }
    const out = normalizeAuditDetails({ obj: new Segredo() });
    expect(JSON.stringify(out)).not.toContain("interno");
  });

  it("é serializável como JSON", () => {
    const out = normalizeAuditDetails({ a: [1, { b: new Date(0) }], c: "x" });
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});
