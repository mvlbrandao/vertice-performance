import { describe, it, expect } from "vitest";
import { overflowEdges, scrollLeftToCenter } from "@/lib/utils/scrollTabs";

describe("overflowEdges", () => {
  it("sem sobra de conteúdo, não sinaliza nada", () => {
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 320, scrollWidth: 320 })).toEqual({
      start: false,
      end: false,
    });
  });

  it("no início da faixa, só há conteúdo escondido à direita", () => {
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 320, scrollWidth: 700 })).toEqual({
      start: false,
      end: true,
    });
  });

  it("no meio, há conteúdo dos dois lados", () => {
    expect(overflowEdges({ scrollLeft: 150, clientWidth: 320, scrollWidth: 700 })).toEqual({
      start: true,
      end: true,
    });
  });

  it("no fim, só há conteúdo escondido à esquerda", () => {
    expect(overflowEdges({ scrollLeft: 380, clientWidth: 320, scrollWidth: 700 })).toEqual({
      start: true,
      end: false,
    });
  });

  it("tolera arredondamento fracionário no fim da faixa", () => {
    expect(overflowEdges({ scrollLeft: 379.6, clientWidth: 320, scrollWidth: 700 }).end).toBe(false);
  });

  it("sobra de 1px de arredondamento não conta como estouro", () => {
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 320, scrollWidth: 321 })).toEqual({
      start: false,
      end: false,
    });
  });
});

describe("scrollLeftToCenter", () => {
  const base = { containerWidth: 300, scrollWidth: 900 };

  it("centraliza uma aba do meio", () => {
    // aba de 100px começando em 400: centro dela em 450, container mostra 300 -> começa em 300
    expect(scrollLeftToCenter({ ...base, itemLeft: 400, itemWidth: 100 })).toBe(300);
  });

  it("não rola além do início para a primeira aba", () => {
    expect(scrollLeftToCenter({ ...base, itemLeft: 0, itemWidth: 100 })).toBe(0);
  });

  it("não passa do fim para a última aba", () => {
    expect(scrollLeftToCenter({ ...base, itemLeft: 800, itemWidth: 100 })).toBe(600);
  });

  it("sem estouro de largura, fica em zero", () => {
    expect(
      scrollLeftToCenter({ containerWidth: 300, scrollWidth: 300, itemLeft: 150, itemWidth: 100 }),
    ).toBe(0);
  });
});
