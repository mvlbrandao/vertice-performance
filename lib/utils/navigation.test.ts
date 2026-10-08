import { describe, it, expect } from "vitest";
import { isNavActive } from "@/lib/utils/navigation";

describe("isNavActive", () => {
  it("acende no caminho idêntico", () => {
    expect(isNavActive("/athletes", "/athletes")).toBe(true);
  });

  it("acende em páginas filhas", () => {
    expect(isNavActive("/athletes/123/dados", "/athletes")).toBe(true);
  });

  it("não confunde prefixo de texto com caminho filho", () => {
    expect(isNavActive("/athletes-arquivados", "/athletes")).toBe(false);
  });

  it("com exact, só acende no caminho idêntico", () => {
    expect(isNavActive("/admin", "/admin", true)).toBe(true);
    expect(isNavActive("/admin/clubes", "/admin", true)).toBe(false);
  });

  it("sem exact, um item raiz acenderia em todos os filhos", () => {
    expect(isNavActive("/admin/clubes", "/admin")).toBe(true);
  });
});
