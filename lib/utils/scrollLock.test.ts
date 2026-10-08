import { describe, it, expect } from "vitest";
import { createScrollLock, type LockTarget } from "@/lib/utils/scrollLock";

function fakeBody(overflow = "", paddingRight = ""): LockTarget {
  return { style: { overflow, paddingRight } };
}

describe("createScrollLock", () => {
  it("esconde a rolagem ao travar e restaura ao soltar", () => {
    const body = fakeBody();
    const lock = createScrollLock(() => body);
    const unlock = lock();
    expect(body.style.overflow).toBe("hidden");
    unlock();
    expect(body.style.overflow).toBe("");
  });

  it("restaura o valor que já estava, não um vazio", () => {
    const body = fakeBody("scroll", "4px");
    const lock = createScrollLock(() => body, () => 15);
    const unlock = lock();
    expect(body.style.paddingRight).toBe("15px");
    unlock();
    expect(body.style.overflow).toBe("scroll");
    expect(body.style.paddingRight).toBe("4px");
  });

  it("compensa a largura da barra de rolagem só quando ela existe", () => {
    const comBarra = fakeBody();
    createScrollLock(() => comBarra, () => 15)();
    expect(comBarra.style.paddingRight).toBe("15px");

    const semBarra = fakeBody();
    createScrollLock(() => semBarra, () => 0)();
    expect(semBarra.style.paddingRight).toBe("");
  });

  it("com duas travas, só a última a soltar destrava a página", () => {
    const body = fakeBody();
    const lock = createScrollLock(() => body);
    const menu = lock();
    const modal = lock();
    menu();
    expect(body.style.overflow).toBe("hidden");
    modal();
    expect(body.style.overflow).toBe("");
  });

  it("soltar a mesma trava duas vezes não destrava a de outro dono", () => {
    const body = fakeBody();
    const lock = createScrollLock(() => body);
    const a = lock();
    lock();
    a();
    a();
    expect(body.style.overflow).toBe("hidden");
  });

  it("sem alvo (render no servidor), não faz nada e não quebra", () => {
    const lock = createScrollLock(() => null);
    expect(() => lock()()).not.toThrow();
  });
});
