import { describe, it, expect } from "vitest";
import { chunk, lerTodasAsPaginas, mapComLimite } from "@/lib/utils/chunk";

describe("chunk", () => {
  it("divide em fatias do tamanho pedido, com sobra na última", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("devolve uma fatia só quando a lista cabe nela", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("lista vazia gera zero fatias, não uma fatia vazia", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("não altera a lista original e preserva a ordem", () => {
    const original = ["a", "b", "c", "d"];
    const fatias = chunk(original, 3);
    expect(fatias.flat()).toEqual(original);
    expect(original).toEqual(["a", "b", "c", "d"]);
  });

  it("recusa tamanho inválido em vez de entrar em laço infinito", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], -1)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
    expect(() => chunk([1], Number.NaN)).toThrow(RangeError);
  });
});

describe("mapComLimite", () => {
  it("devolve os resultados na ordem de entrada, não na de conclusão", async () => {
    // O primeiro item demora mais que os outros: se a ordem seguisse a
    // conclusão, ele apareceria por último.
    const atrasos = [30, 5, 5, 5];
    const saida = await mapComLimite(atrasos, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(saida).toEqual([0, 1, 2, 3]);
  });

  it("nunca passa do limite de chamadas simultâneas", async () => {
    let emVoo = 0;
    let pico = 0;
    await mapComLimite(Array.from({ length: 12 }), 3, async () => {
      emVoo++;
      pico = Math.max(pico, emVoo);
      await new Promise((r) => setTimeout(r, 2));
      emVoo--;
    });
    expect(pico).toBe(3);
  });

  it("aceita lista vazia e limite maior que a lista", async () => {
    expect(await mapComLimite([], 3, async () => 1)).toEqual([]);
    expect(await mapComLimite([1, 2], 10, async (n) => n * 2)).toEqual([2, 4]);
  });

  it("propaga a falha de uma das chamadas", async () => {
    await expect(
      mapComLimite([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("falhou");
        return n;
      }),
    ).rejects.toThrow("falhou");
  });

  it("recusa limite inválido", async () => {
    await expect(mapComLimite([1], 0, async () => 1)).rejects.toThrow(RangeError);
  });
});

describe("lerTodasAsPaginas", () => {
  /** Simula o PostgREST: respeita o range pedido e corta em `maxRows`. */
  function servidor(total: number, maxRows = 1000) {
    const chamadas: [number, number][] = [];
    const lerPagina = async (de: number, ate: number) => {
      chamadas.push([de, ate]);
      const fim = Math.min(ate + 1, de + maxRows, total);
      const data = Array.from({ length: Math.max(0, fim - de) }, (_, i) => de + i);
      return { data, error: null };
    };
    return { chamadas, lerPagina };
  }

  it("uma página só quando o resultado cabe nela", async () => {
    const s = servidor(40);
    const r = await lerTodasAsPaginas(s.lerPagina, 1000);
    expect(r.linhas).toHaveLength(40);
    expect(r.erro).toBeNull();
    expect(s.chamadas).toEqual([[0, 999]]);
  });

  it("junta as páginas quando passa do corte de 1000 linhas", async () => {
    const s = servidor(2500);
    const r = await lerTodasAsPaginas(s.lerPagina, 1000);
    expect(r.linhas).toHaveLength(2500);
    expect(r.linhas[0]).toBe(0);
    expect(r.linhas[2499]).toBe(2499);
    expect(s.chamadas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("múltiplo exato do tamanho da página custa uma leitura vazia a mais", async () => {
    const s = servidor(2000);
    const r = await lerTodasAsPaginas(s.lerPagina, 1000);
    expect(r.linhas).toHaveLength(2000);
    expect(s.chamadas).toHaveLength(3);
  });

  it("devolve o que já leu e a mensagem do erro, sem lançar", async () => {
    let n = 0;
    const r = await lerTodasAsPaginas(async () => {
      n++;
      if (n === 2) return { data: null, error: { message: "boom" } };
      return { data: Array.from({ length: 10 }, (_, i) => i), error: null };
    }, 10);
    expect(r.erro).toBe("boom");
    expect(r.linhas).toHaveLength(10);
  });

  it("trata data nulo como página vazia", async () => {
    const r = await lerTodasAsPaginas(async () => ({ data: null, error: null }));
    expect(r).toEqual({ linhas: [], erro: null });
  });

  it("aborta como erro, não como sucesso, se o servidor ignorar o range", async () => {
    const r = await lerTodasAsPaginas(
      async () => ({ data: Array.from({ length: 5 }, (_, i) => i), error: null }),
      5,
      3,
    );
    expect(r.erro).toMatch(/3 páginas/);
    expect(r.linhas).toHaveLength(15);
  });
});
