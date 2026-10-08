import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" explode fora do servidor do Next; aqui só interessa a lógica.
vi.mock("server-only", () => ({}));

// cache() do React memoiza por requisição; no teste cada caso é uma requisição.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

// redirect/notFound do Next lançam para interromper a renderização; imita isso.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

interface FakeUser {
  id: string;
  email: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

const state: {
  user: FakeUser | null;
  profileName: string | null;
  aal: string | null;
  aalCalls: number;
} = { user: null, profileName: null, aal: "aal1", aalCalls: 0 };

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: async () => ({
    user: state.user,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "jwt" } } }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => {
            state.aalCalls += 1;
            return { data: { currentLevel: state.aal, nextLevel: "aal2" }, error: null };
          },
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: state.profileName ? { full_name: state.profileName } : null,
            }),
          }),
        }),
      }),
    },
  }),
}));

import {
  getPlatformAdmin,
  isPlatformAdmin,
  isReservedAdminEmail,
  platformAdminEmails,
  platformAdminRequiresMfa,
  requirePlatformAdmin,
} from "./admin";

const DONO: FakeUser = {
  id: "u-1",
  email: "dono@exemplo.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  user_metadata: {},
};

beforeEach(() => {
  state.user = null;
  state.profileName = null;
  state.aal = "aal1";
  state.aalCalls = 0;
  vi.stubEnv("PLATFORM_ADMIN_EMAILS", "dono@exemplo.com");
  vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requirePlatformAdmin", () => {
  it("sem sessão manda para o login", async () => {
    await expect(requirePlatformAdmin()).rejects.toThrow("REDIRECT:/login");
  });

  it("logado fora da lista recebe 404, não redirecionamento", async () => {
    state.user = { ...DONO, id: "u-2", email: "outro@exemplo.com" };
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("variável vazia ou ausente dá 404 a todos, inclusive ao dono", async () => {
    state.user = DONO;
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "   ");
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("e-mail não confirmado dá 404 mesmo estando na lista", async () => {
    state.user = { ...DONO, email_confirmed_at: null };
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("libera o dono sem exigir perfil de clube; nome cai para o e-mail", async () => {
    state.user = DONO;
    await expect(requirePlatformAdmin()).resolves.toEqual({
      userId: "u-1",
      email: "dono@exemplo.com",
      fullName: "dono@exemplo.com",
    });
  });

  it("nome: perfil de clube vence o cadastrado no Auth, que vence o e-mail", async () => {
    state.user = { ...DONO, user_metadata: { full_name: "  Nome do Auth " } };
    expect((await requirePlatformAdmin()).fullName).toBe("Nome do Auth");

    state.profileName = "Nome do Perfil";
    expect((await requirePlatformAdmin()).fullName).toBe("Nome do Perfil");
  });

  it("compara o e-mail sem diferenciar maiúsculas", async () => {
    state.user = { ...DONO, email: "DONO@Exemplo.com" };
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ userId: "u-1" });
  });

  it("MFA desligado (padrão): sessão aal1 entra e nem consulta o nível", async () => {
    state.user = DONO;
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ userId: "u-1" });
    expect(state.aalCalls).toBe(0);
  });

  it("MFA exigido e sessão aal1 vai para a tela de segurança", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = DONO;
    state.aal = "aal1";
    await expect(requirePlatformAdmin()).rejects.toThrow("REDIRECT:/admin/seguranca");
  });

  it("MFA exigido: a tela de segurança abre em aal1 (allowAal1)", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = DONO;
    state.aal = "aal1";
    await expect(requirePlatformAdmin({ allowAal1: true })).resolves.toMatchObject({ userId: "u-1" });
  });

  it("MFA exigido e sessão aal2 entra", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = DONO;
    state.aal = "aal2";
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ userId: "u-1" });
  });

  it("allowAal1 não abre para quem não é da lista", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = { ...DONO, email: "outro@exemplo.com" };
    await expect(requirePlatformAdmin({ allowAal1: true })).rejects.toThrow("NOT_FOUND");
  });

  it("quem não é da lista nunca dispara a consulta de nível (nenhuma ida extra ao Auth)", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = { ...DONO, email: "outro@exemplo.com" };
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
    expect(state.aalCalls).toBe(0);
  });
});

describe("getPlatformAdmin / isPlatformAdmin", () => {
  it("devolve a identidade do dono e null para os demais", async () => {
    expect(await getPlatformAdmin()).toBeNull();
    expect(await isPlatformAdmin()).toBe(false);

    state.user = { ...DONO, email: "outro@exemplo.com" };
    expect(await isPlatformAdmin()).toBe(false);

    state.user = DONO;
    expect(await isPlatformAdmin()).toBe(true);
    expect(await getPlatformAdmin()).toMatchObject({ userId: "u-1", email: "dono@exemplo.com" });
  });

  it("sessão aal1 com MFA exigido ainda é o administrador (serve ao menu e ao login)", async () => {
    vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", "true");
    state.user = DONO;
    state.aal = "aal1";
    expect(await isPlatformAdmin()).toBe(true);
  });
});

describe("configuração por ambiente", () => {
  it("platformAdminEmails normaliza a lista", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", " A@x.com, b@X.com ");
    expect(platformAdminEmails()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("só 'true' (ou '1') liga a exigência de MFA", () => {
    for (const [valor, esperado] of [
      ["true", true],
      ["TRUE", true],
      [" true ", true],
      ["1", true],
      ["false", false],
      ["yes", false],
      ["", false],
    ] as const) {
      vi.stubEnv("PLATFORM_ADMIN_REQUIRE_MFA", valor);
      expect(platformAdminRequiresMfa(), valor).toBe(esperado);
    }
  });

  it("isReservedAdminEmail reconhece o e-mail do dono em qualquer caixa", () => {
    expect(isReservedAdminEmail("dono@exemplo.com")).toBe(true);
    expect(isReservedAdminEmail("  DONO@exemplo.COM ")).toBe(true);
    expect(isReservedAdminEmail("outro@exemplo.com")).toBe(false);
  });

  it("isReservedAdminEmail não reserva nada com a lista vazia nem para e-mail vazio", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect(isReservedAdminEmail("dono@exemplo.com")).toBe(false);
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "dono@exemplo.com");
    expect(isReservedAdminEmail("")).toBe(false);
    expect(isReservedAdminEmail(null)).toBe(false);
    expect(isReservedAdminEmail(undefined)).toBe(false);
  });
});
