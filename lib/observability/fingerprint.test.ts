import { describe, expect, it, vi } from "vitest";

// record.ts importa "server-only" e o client de serviço; o hash em si é puro.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { fingerprintKey, normalizeForFingerprint } from "./fingerprint";
import { hashFingerprint } from "./record";

describe("normalizeForFingerprint", () => {
  it("ignora caixa e espaços repetidos", () => {
    expect(normalizeForFingerprint("  Cannot   READ\nproperties ")).toBe("cannot read properties");
  });

  it("troca carimbos de data/hora e números longos por um marcador", () => {
    expect(normalizeForFingerprint("falhou em 2026-10-08T12:30:45.123Z (job 987654321)")).toBe(
      "falhou em # (job #)",
    );
    expect(normalizeForFingerprint("em 2026-10-08 12:30 e 2026-10-09")).toBe("em # e #");
  });

  it("mantém códigos curtos, que costumam ser a causa", () => {
    expect(normalizeForFingerprint("status 409 código 23503")).toBe("status 409 código 23503");
  });
});

describe("fingerprintKey / hashFingerprint", () => {
  it("a mesma falha dá a mesma chave, mesmo com id e hora diferentes", () => {
    const a = fingerprintKey("route", "/athletes/:id", "timeout em 2026-10-08T10:00:00Z job 11111111");
    const b = fingerprintKey("route", "/athletes/:id", "TIMEOUT em 2026-10-09T23:59:59Z job 22222222");
    expect(a).toBe(b);
    expect(hashFingerprint(a)).toBe(hashFingerprint(b));
  });

  it("o hash é estável entre execuções (valor fixo)", () => {
    // SHA-256("route|/x|boom") truncado em 32 hex. Se isto mudar, TODOS os grupos
    // de erro já gravados deixam de casar com os novos: mudança consciente ou bug.
    expect(hashFingerprint("route|/x|boom")).toBe("daad9e01a9d3b33d8c0003c00fd64d82");
  });

  it("origem, rota ou mensagem diferentes viram grupos diferentes", () => {
    const base = hashFingerprint(fingerprintKey("route", "/a", "boom"));
    expect(hashFingerprint(fingerprintKey("render", "/a", "boom"))).not.toBe(base);
    expect(hashFingerprint(fingerprintKey("route", "/b", "boom"))).not.toBe(base);
    expect(hashFingerprint(fingerprintKey("route", "/a", "bang"))).not.toBe(base);
  });
});
