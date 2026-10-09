import { describe, expect, it } from "vitest";
import { buildLicenseSnapshot, type LicenseClubInput } from "@/lib/platform/licenseSnapshot";

const AGORA = new Date("2026-10-08T15:00:00Z");
const PADRAO = { priceCents: 14990, maxAthletes: 50 };

function clube(over: Partial<LicenseClubInput> = {}): LicenseClubInput {
  return {
    status: "ativo",
    trial_ends_at: null,
    courtesy_until: null,
    max_athletes_override: null,
    price_cents_override: null,
    is_demo: false,
    ...over,
  };
}

const snap = (over: Partial<LicenseClubInput> = {}) => buildLicenseSnapshot(clube(over), PADRAO, AGORA);

describe("buildLicenseSnapshot: acesso (espelha getClubLicense)", () => {
  it("ativo e atrasado entram; atraso mostra aviso, não porta fechada", () => {
    expect(snap({ status: "ativo" }).allowed).toBe(true);
    expect(snap({ status: "atrasado" }).allowed).toBe(true);
  });

  it("bloqueado e cancelado não entram", () => {
    expect(snap({ status: "bloqueado" }).allowed).toBe(false);
    expect(snap({ status: "cancelado" }).allowed).toBe(false);
  });

  it("teste: entra enquanto não vence; vencido ou sem data bloqueia", () => {
    expect(snap({ status: "trial", trial_ends_at: "2026-10-09T02:59:59Z" }).allowed).toBe(true);
    expect(snap({ status: "trial", trial_ends_at: "2026-10-08T15:00:00Z" }).allowed).toBe(false);
    expect(snap({ status: "trial", trial_ends_at: "2026-10-01T00:00:00Z" }).allowed).toBe(false);
    expect(snap({ status: "trial", trial_ends_at: null }).allowed).toBe(false);
  });

  it("cortesia ativa vence tudo: libera bloqueado, cancelado e teste vencido", () => {
    for (const status of ["bloqueado", "cancelado", "trial", "atrasado"] as const) {
      const s = snap({ status, courtesy_until: "2026-12-31T23:59:59Z" });
      expect(s.allowed, status).toBe(true);
      expect(s.courtesyActive).toBe(true);
      expect(s.courtesyUntil).toBe("2026-12-31");
    }
  });

  it("cortesia vencida não vale e não aparece", () => {
    const s = snap({ status: "bloqueado", courtesy_until: "2026-10-01T23:59:59Z" });
    expect(s.allowed).toBe(false);
    expect(s.courtesyActive).toBe(false);
    expect(s.courtesyUntil).toBeNull();
  });
});

describe("buildLicenseSnapshot: preço e cota", () => {
  it("usa o plano padrão quando o clube não tem valor próprio", () => {
    const s = snap();
    expect(s.priceCents).toBe(14990);
    expect(s.maxAthletes).toBe(50);
    expect(s.defaultMaxAthletes).toBe(50);
  });

  it("valor próprio do clube vence o padrão, inclusive preço zero", () => {
    expect(snap({ price_cents_override: 9990 }).priceCents).toBe(9990);
    expect(snap({ price_cents_override: 0 }).priceCents).toBe(0);
    const s = snap({ max_athletes_override: 80 });
    expect(s.maxAthletes).toBe(80);
    expect(s.defaultMaxAthletes).toBe(50);
  });

  it("repassa o status e a marca de demonstração", () => {
    const s = snap({ status: "atrasado", is_demo: true });
    expect(s.status).toBe("atrasado");
    expect(s.isDemo).toBe(true);
  });
});
