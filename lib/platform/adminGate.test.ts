import { describe, expect, it } from "vitest";
import {
  decideAdminGate,
  maskEmail,
  normalizeEmail,
  parseAdminAllowlist,
  type AdminGateInput,
} from "./adminGate";

const base: AdminGateInput = {
  authenticated: true,
  email: "dono@exemplo.com",
  emailConfirmed: true,
  allowlist: ["dono@exemplo.com"],
  requireMfa: false,
  aal: "aal1",
};

describe("decideAdminGate", () => {
  it("libera quem está na lista, com e-mail confirmado", () => {
    expect(decideAdminGate(base)).toBe("allow");
  });

  it("manda para o login quem não tem sessão, esteja a lista como estiver", () => {
    expect(decideAdminGate({ ...base, authenticated: false })).toBe("login");
    expect(decideAdminGate({ ...base, authenticated: false, allowlist: [] })).toBe("login");
  });

  it("lista vazia bloqueia todos, inclusive quem teria o mesmo e-mail", () => {
    expect(decideAdminGate({ ...base, allowlist: [] })).toBe("not_found");
    expect(decideAdminGate({ ...base, allowlist: ["", "  "] })).toBe("not_found");
  });

  it("não deixa e-mail vazio casar com entrada vazia da lista", () => {
    expect(decideAdminGate({ ...base, email: "", allowlist: [""] })).toBe("not_found");
    expect(decideAdminGate({ ...base, email: null, allowlist: ["", "dono@exemplo.com"] })).toBe(
      "not_found",
    );
    expect(decideAdminGate({ ...base, email: "   ", allowlist: ["  "] })).toBe("not_found");
  });

  it("logado fora da lista recebe not_found (404), não login", () => {
    expect(decideAdminGate({ ...base, email: "outro@exemplo.com" })).toBe("not_found");
  });

  it("não diferencia maiúsculas nem espaços nas pontas, dos dois lados", () => {
    expect(decideAdminGate({ ...base, email: "  DONO@Exemplo.COM " })).toBe("allow");
    expect(decideAdminGate({ ...base, allowlist: ["  Dono@EXEMPLO.com  "] })).toBe("allow");
  });

  it("não aceita variação do endereço (alias com +, domínio parecido)", () => {
    expect(decideAdminGate({ ...base, email: "dono+x@exemplo.com" })).toBe("not_found");
    expect(decideAdminGate({ ...base, email: "dono@exemplo.com.br" })).toBe("not_found");
  });

  it("nega e-mail não confirmado, mesmo estando na lista", () => {
    expect(decideAdminGate({ ...base, emailConfirmed: false })).toBe("not_found");
  });

  it("MFA desligado: aal1 passa", () => {
    expect(decideAdminGate({ ...base, requireMfa: false, aal: "aal1" })).toBe("allow");
    expect(decideAdminGate({ ...base, requireMfa: false, aal: null })).toBe("allow");
  });

  it("MFA exigido e sessão aal1 pede o segundo fator", () => {
    expect(decideAdminGate({ ...base, requireMfa: true, aal: "aal1" })).toBe("mfa_required");
  });

  it("MFA exigido e nível desconhecido também pede o segundo fator (falha fechada)", () => {
    expect(decideAdminGate({ ...base, requireMfa: true, aal: null })).toBe("mfa_required");
    expect(decideAdminGate({ ...base, requireMfa: true, aal: undefined })).toBe("mfa_required");
  });

  it("MFA exigido e sessão aal2 libera", () => {
    expect(decideAdminGate({ ...base, requireMfa: true, aal: "aal2" })).toBe("allow");
  });

  it("página que permite aal1 libera a sessão aal1 mesmo com MFA exigido", () => {
    expect(decideAdminGate({ ...base, requireMfa: true, aal: "aal1", allowAal1: true })).toBe(
      "allow",
    );
  });

  it("allowAal1 não contorna a lista nem a confirmação do e-mail", () => {
    const aberto = { ...base, requireMfa: true, aal: "aal1", allowAal1: true };
    expect(decideAdminGate({ ...aberto, email: "outro@exemplo.com" })).toBe("not_found");
    expect(decideAdminGate({ ...aberto, emailConfirmed: false })).toBe("not_found");
    expect(decideAdminGate({ ...aberto, authenticated: false })).toBe("login");
    expect(decideAdminGate({ ...aberto, allowlist: [] })).toBe("not_found");
  });

  it("estranho logado não descobre que a área pede MFA", () => {
    expect(
      decideAdminGate({ ...base, email: "outro@exemplo.com", requireMfa: true, aal: "aal1" }),
    ).toBe("not_found");
  });
});

describe("parseAdminAllowlist", () => {
  it("normaliza, tira duplicatas e ignora vazios", () => {
    expect(parseAdminAllowlist(" A@x.com , b@x.com,, a@X.com ")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("aceita ponto e vírgula, espaço e quebra de linha como separador", () => {
    expect(parseAdminAllowlist("a@x.com;b@x.com c@x.com\nd@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("tira aspas coladas junto do valor", () => {
    expect(parseAdminAllowlist('"a@x.com"')).toEqual(["a@x.com"]);
    expect(parseAdminAllowlist("'a@x.com','b@x.com'")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("variável ausente ou vazia vira lista vazia", () => {
    expect(parseAdminAllowlist(undefined)).toEqual([]);
    expect(parseAdminAllowlist(null)).toEqual([]);
    expect(parseAdminAllowlist("")).toEqual([]);
    expect(parseAdminAllowlist(" , ; ")).toEqual([]);
  });
});

describe("normalizeEmail", () => {
  it("tira espaços e passa para minúsculas", () => {
    expect(normalizeEmail("  Ana@Exemplo.COM ")).toBe("ana@exemplo.com");
  });

  it("tolera ausência", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("maskEmail", () => {
  it("mantém só a primeira e a última letra do usuário", () => {
    expect(maskEmail("maria.silva@gmail.com")).toBe("m***a@gmail.com");
  });

  it("usuário curto mostra só a primeira letra", () => {
    expect(maskEmail("ab@x.com")).toBe("a***@x.com");
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
  });

  it("não vaza nada quando não parece um e-mail", () => {
    expect(maskEmail("semarroba")).toBe("***");
    expect(maskEmail("@x.com")).toBe("***");
    expect(maskEmail("a@")).toBe("***");
    expect(maskEmail("")).toBe("***");
    expect(maskEmail(null)).toBe("***");
  });

  it("não devolve o endereço original em nenhum caso", () => {
    const original = "dono@exemplo.com";
    expect(maskEmail(original)).not.toContain("dono");
  });
});
