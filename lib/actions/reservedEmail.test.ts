import { beforeEach, describe, expect, it, vi } from "vitest";

// O e-mail do administrador da plataforma não pode virar conta de clube por
// nenhum dos quatro caminhos de criação de conta. Estes testes garantem que a
// recusa vem ANTES de qualquer efeito (conta criada, clube criado, convite gasto).

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  touched: [] as string[],
}));

// Qualquer uso do client de serviço ou do client de sessão antes da recusa é falha.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    h.touched.push("createAdminClient");
    throw new Error("createAdminClient não deveria ser chamado");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    h.touched.push("createClient");
    throw new Error("createClient não deveria ser chamado");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCoach: async () => ({ userId: "u-coach", clubId: "c-1", fullName: "Treinador", role: "coach" }),
}));
vi.mock("@/lib/platform/license", () => ({
  getPlatformSettings: async () => ({ trialDays: 15 }),
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/actions/auditLog", () => ({ logAudit: async () => {}, diffFields: () => ({}) }));

// A lista real é lida do ambiente por lib/platform/admin.ts (testada à parte);
// aqui só se fixa o que ela devolve.
vi.mock("@/lib/platform/admin", () => ({
  isReservedAdminEmail: (email: string | null | undefined) =>
    (email ?? "").trim().toLowerCase() === "dono@exemplo.com",
}));

import { signup } from "./signup";
import { inviteStaff } from "./staff";
import { provisionAthleteAccount } from "./provisionAthleteAccount";
import { redeemInviteLink } from "./inviteLinks";

beforeEach(() => {
  h.touched = [];
});

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("e-mail reservado do administrador", () => {
  it("o cadastro público recusa, sem criar clube nem conta", async () => {
    const result = await signup(
      form({
        clubName: "Clube Teste",
        fullName: "Alguém",
        email: "  DONO@exemplo.com ",
        password: "12345678",
      }),
    );
    expect(result).toEqual({ error: "E-mail indisponível." });
    expect(h.touched).toEqual([]);
  });

  it("o convite de profissional recusa", async () => {
    const result = await inviteStaff(
      form({ fullName: "Fulano", email: "dono@exemplo.com", title: "Fisio" }),
    );
    expect(result).toEqual({ error: "E-mail indisponível." });
    expect(h.touched).toEqual([]);
  });

  it("o convite de atleta recusa antes de consultar o atleta", async () => {
    const result = await provisionAthleteAccount({
      athleteId: "a-1",
      email: "Dono@Exemplo.com",
      fullName: "Atleta",
    });
    expect(result).toEqual({ error: "E-mail indisponível." });
    expect(h.touched).toEqual([]);
  });

  it("o resgate de convite recusa antes de reservar o link de ninguém", async () => {
    const result = await redeemInviteLink({
      token: "token-de-teste-longo",
      email: "dono@exemplo.com",
      password: "12345678",
    });
    expect(result).toEqual({ error: "E-mail indisponível." });
    expect(h.touched).toEqual([]);
  });

  it("a mensagem não revela que o endereço é especial", async () => {
    const reservado = await signup(
      form({ clubName: "Clube", fullName: "X Y", email: "dono@exemplo.com", password: "12345678" }),
    );
    expect(reservado.error).not.toMatch(/admin|plataforma|reservad/i);
  });

  it("e-mail comum segue adiante (chega a usar o banco)", async () => {
    await expect(
      signup(form({ clubName: "Clube", fullName: "X Y", email: "comum@exemplo.com", password: "12345678" })),
    ).rejects.toThrow("createAdminClient não deveria ser chamado");
    expect(h.touched).toContain("createAdminClient");
  });
});
