import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("deixa passar até N por janela e barra o excedente", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    const resultados = Array.from({ length: 6 }, (_, i) => limiter.allow("falha-x", 1_000 + i));
    expect(resultados).toEqual([true, true, true, false, false, false]);
  });

  it("conta cada chave separadamente", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(false);
    expect(limiter.allow("b", 2)).toBe(true);
  });

  it("libera de novo quando a janela vence", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 59_999)).toBe(false);
    expect(limiter.allow("a", 60_000)).toBe(true);
    expect(limiter.allow("a", 60_001)).toBe(false);
  });

  it("uma falha em laço grava no máximo N por minuto, em qualquer ritmo", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
    let gravadas = 0;
    for (let ms = 0; ms < 60_000; ms += 10) if (limiter.allow("laco", ms)) gravadas += 1;
    expect(gravadas).toBe(5);
  });

  it("não cresce sem limite: passado maxKeys, descarta o que venceu e, se preciso, recomeça", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1_000, maxKeys: 3 });
    for (let i = 0; i < 100; i++) limiter.allow(`k${i}`, 0);
    // Não estourou nem lançou; e uma chave nova continua sendo aceita.
    expect(limiter.allow("nova", 10)).toBe(true);
  });

  it("max 0 barra tudo", () => {
    const limiter = createRateLimiter({ max: 0, windowMs: 1_000 });
    expect(limiter.allow("a", 0)).toBe(false);
  });
});
