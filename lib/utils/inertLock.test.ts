import { describe, it, expect } from "vitest";
import { createInertLock, type InertTarget } from "@/lib/utils/inertLock";

function el(inert = false): InertTarget {
  return { inert };
}

describe("createInertLock", () => {
  it("isola os demais elementos, menos o mantido, e restaura ao soltar", () => {
    const raiz = el();
    const ajuda = el();
    const fundo = el();
    const lock = createInertLock(() => [raiz, ajuda, fundo]);

    const unlock = lock(fundo);
    expect(raiz.inert).toBe(true);
    expect(ajuda.inert).toBe(true);
    expect(fundo.inert).toBe(false);

    unlock();
    expect(raiz.inert).toBe(false);
    expect(ajuda.inert).toBe(false);
  });

  it("não toca em quem já estava inerte por outro motivo", () => {
    const raiz = el();
    const jaInerte = el(true);
    const fundo = el();
    const lock = createInertLock(() => [raiz, jaInerte, fundo]);

    const unlock = lock(fundo);
    expect(jaInerte.inert).toBe(true);
    unlock();
    expect(jaInerte.inert).toBe(true);
    expect(raiz.inert).toBe(false);
  });

  it("modal sobre modal: fechar o de cima reabilita o de baixo, mas não a página", () => {
    const raiz = el();
    const fundoA = el();
    const fundoB = el();
    // O fundo de B só existe depois que A já está aberto.
    const dom: InertTarget[] = [raiz, fundoA];
    const lock = createInertLock(() => dom);

    const soltaA = lock(fundoA);
    dom.push(fundoB);
    const soltaB = lock(fundoB);
    expect(raiz.inert).toBe(true);
    expect(fundoA.inert).toBe(true);
    expect(fundoB.inert).toBe(false);

    soltaB();
    expect(fundoA.inert).toBe(false);
    expect(raiz.inert).toBe(true);

    soltaA();
    expect(raiz.inert).toBe(false);
  });

  it("fechar o de baixo primeiro mantém a página isolada até o de cima fechar", () => {
    const raiz = el();
    const fundoA = el();
    const fundoB = el();
    const dom: InertTarget[] = [raiz, fundoA];
    const lock = createInertLock(() => dom);

    const soltaA = lock(fundoA);
    dom.push(fundoB);
    const soltaB = lock(fundoB);

    soltaA();
    expect(raiz.inert).toBe(true);
    soltaB();
    expect(raiz.inert).toBe(false);
  });

  it("soltar a mesma trava duas vezes não reabilita o que outro modal ainda isola", () => {
    const raiz = el();
    const fundoA = el();
    const fundoB = el();
    const dom: InertTarget[] = [raiz, fundoA, fundoB];
    const lock = createInertLock(() => dom);

    const soltaA = lock(fundoA);
    const soltaB = lock(fundoB);
    soltaA();
    soltaA();
    expect(raiz.inert).toBe(true);
    soltaB();
    expect(raiz.inert).toBe(false);
  });

  it("sem candidatos não faz nada", () => {
    const lock = createInertLock<InertTarget>(() => []);
    expect(() => lock(el())()).not.toThrow();
  });
});
