import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, messageOf, sanitizeMessage } from "./sanitize";

describe("sanitizeMessage", () => {
  it("remove e-mails, mesmo com + e subdomínios", () => {
    const out = sanitizeMessage('duplicate key value violates unique constraint (email)=(ana.silva+teste@clube.com.br)');
    expect(out).not.toContain("ana.silva");
    expect(out).not.toContain("@");
    expect(out).toContain("[email]");
    // O nome da restrição é o que ajuda a achar o defeito: continua legível.
    expect(out).toContain("unique constraint");
  });

  it("remove UUIDs, em qualquer caixa", () => {
    const id = "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f";
    const out = sanitizeMessage(`Key (club_id)=(${id}) is not present; ${id.toUpperCase()}`);
    expect(out).not.toContain("8f14e45f");
    expect(out.toLowerCase()).not.toContain("0a1b2c3d4e5f");
    expect(out).toContain("[id]");
  });

  it("remove JWT e cabeçalho Authorization", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const out = sanitizeMessage(`fetch failed: Authorization: Bearer ${jwt} (jwt ${jwt})`);
    expect(out).not.toContain("eyJ");
    expect(out).not.toContain("SflKxw");
    expect(out).toMatch(/\[token\]|\[removido\]/);
  });

  it("remove CPF e CNPJ, com e sem máscara", () => {
    const out = sanitizeMessage(
      "CPF 123.456.789-09, sem máscara 12345678909, CNPJ 12.345.678/0001-95 e 12345678000195",
    );
    expect(out).not.toMatch(/123\.456\.789/);
    expect(out).not.toContain("12345678909");
    expect(out).not.toContain("12.345.678/0001");
    expect(out).not.toContain("12345678000195");
  });

  it("remove telefone brasileiro, com e sem máscara", () => {
    const out = sanitizeMessage("falha ao enviar para (83) 98888-7777 e +55 83 98888-7777 e 83988887777");
    expect(out).not.toContain("98888");
    expect(out).not.toContain("88887777");
  });

  it("remove query string inteira (token na URL não pode ficar)", () => {
    const out = sanitizeMessage(
      "GET https://x.supabase.co/rest/v1/profiles?select=*&access_token=abc123&club_id=eq.1 falhou",
    );
    expect(out).not.toContain("access_token");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("select=*");
    expect(out).toContain("falhou");
  });

  it("não toca num '?' de pergunta no fim da frase", () => {
    expect(sanitizeMessage("Algo deu errado, tente de novo?")).toBe("Algo deu errado, tente de novo?");
  });

  it("remove credencial escrita como chave=valor", () => {
    const out = sanitizeMessage("falha: api_key=sk_live_ABCDEF, password: hunter2, senha=segredo");
    expect(out).not.toContain("sk_live");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("segredo");
  });

  it("remove sequências longas de dígitos (cartão, id numérico) mas mantém códigos curtos", () => {
    const out = sanitizeMessage("cartão 4111111111111111 falhou com status 409 (23503)");
    expect(out).not.toContain("4111111111111111");
    expect(out).toContain("409");
    expect(out).toContain("23503");
  });

  it("remove token opaco longo, mas preserva nome de restrição (só letras e sublinhado)", () => {
    const constraint = "athlete_enrollment_requests_reviewed_by_fkey";
    const out = sanitizeMessage(`violates foreign key constraint "${constraint}" key sk4Fh29dLpQ8zXv1Ym7Nc3Rt0aBe`);
    expect(out).toContain(constraint);
    expect(out).not.toContain("sk4Fh29dLpQ8zXv1Ym7Nc3Rt0aBe");
  });

  it("trunca em ~300 caracteres, termina em reticências e vale DEPOIS da limpeza", () => {
    const out = sanitizeMessage("x".repeat(5_000));
    expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(out.endsWith("…")).toBe(true);

    // Um e-mail que começa antes do corte e termina depois dele não pode vazar pela metade.
    const email = "pessoa.muito.reservada@dominio-privado.com.br";
    const longo = sanitizeMessage(`${"a ".repeat(140)}${email}`);
    expect(longo).not.toContain("pessoa");
    expect(longo).not.toContain("dominio-privado");
  });

  it("não deixa meio par substituto (emoji) pendurado no corte", () => {
    const out = sanitizeMessage("😀".repeat(400), 11);
    // Nenhum surrogate solto: a string re-codifica sem U+FFFD.
    expect(new TextDecoder().decode(new TextEncoder().encode(out))).toBe(out);
  });

  it("devolve uma linha só (quebras e controles viram espaço)", () => {
    expect(sanitizeMessage("linha 1\n  linha 2\r\n\tlinha 3\u0000fim")).toBe("linha 1 linha 2 linha 3 fim");
  });

  it("mensagem vazia vira um texto padrão, não string vazia", () => {
    expect(sanitizeMessage("")).toBe("(sem mensagem)");
    expect(sanitizeMessage("   \n ")).toBe("(sem mensagem)");
  });

  it("é idempotente", () => {
    const uma = sanitizeMessage("erro para ana@x.com no clube 8f14e45f-ceea-467a-9575-0a1b2c3d4e5f ?a=1");
    expect(sanitizeMessage(uma)).toBe(uma);
  });

  it("aceita qualquer coisa lançada sem lançar de novo", () => {
    expect(sanitizeMessage(new Error("boom"))).toBe("boom");
    expect(sanitizeMessage({ message: "do objeto" })).toBe("do objeto");
    expect(sanitizeMessage(null)).toBe("null");
    expect(sanitizeMessage(undefined)).toBe("undefined");
    expect(sanitizeMessage(42)).toBe("42");
    expect(sanitizeMessage(Object.create(null))).toBe("(sem mensagem)");
  });

  it("não gasta CPU com mensagem gigante", () => {
    const inicio = Date.now();
    sanitizeMessage("a1".repeat(1_000_000));
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});

describe("messageOf", () => {
  it("usa o nome quando o Error não tem mensagem", () => {
    const e = new TypeError("");
    expect(messageOf(e)).toBe("TypeError");
  });
});
