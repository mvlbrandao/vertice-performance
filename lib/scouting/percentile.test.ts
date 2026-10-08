import { describe, it, expect } from "vitest";
import {
  AMOSTRA_MINIMA,
  calcularPercentilSistema,
  derivarNuvens,
  percentileRank,
  type ParAmostrado,
} from "@/lib/scouting/percentile";

const par = (n: number, attack: number, defense: number): ParAmostrado => ({
  id: `atleta-${n}`,
  attack,
  defense,
});

describe("percentileRank", () => {
  it("lista vazia = 50", () => {
    expect(percentileRank(70, [])).toBe(50);
  });

  it("maior de todos chega perto de 100, menor perto de 0", () => {
    const todos = [10, 20, 30, 40, 50];
    expect(percentileRank(50, todos)).toBe(90); // 4 abaixo + 0,5 do empate consigo
    expect(percentileRank(10, todos)).toBe(10);
  });

  it("grupo todo igual fica no meio", () => {
    expect(percentileRank(60, [60, 60, 60, 60])).toBe(50);
  });

  it("valor acima de todos = 100", () => {
    expect(percentileRank(99, [10, 20, 30])).toBe(100);
  });
});

describe("calcularPercentilSistema", () => {
  const amostra = [par(1, 40, 30), par(2, 50, 50), par(3, 60, 70), par(4, 70, 90)];

  it("devolve null abaixo da amostra mínima (4 outros + ele = 5 é o piso)", () => {
    expect(AMOSTRA_MINIMA).toBe(5);
    expect(calcularPercentilSistema("eu", { x: 50, y: 50 }, amostra.slice(0, 3))).toBeNull();
    expect(calcularPercentilSistema("eu", { x: 50, y: 50 }, [])).toBeNull();
    expect(calcularPercentilSistema("eu", { x: 50, y: 50 }, amostra)).not.toBeNull();
  });

  it("conta o próprio atleta na amostra (sampleSize = outros + 1)", () => {
    expect(calcularPercentilSistema("eu", { x: 55, y: 60 }, amostra)?.sampleSize).toBe(5);
  });

  it("calcula ataque e defesa separadamente, com o valor ao vivo do atleta", () => {
    const r = calcularPercentilSistema("eu", { x: 65, y: 20 }, amostra);
    // ataque 65 entre [40,50,60,70,65]: 3 abaixo + 0,5 → 3,5/5 = 70
    expect(r?.attackPercentile).toBe(70);
    // defesa 20 entre [30,50,70,90,20]: nenhum abaixo + 0,5 → 0,5/5 = 10
    expect(r?.defensePercentile).toBe(10);
  });

  it("não conta o atleta duas vezes quando a amostra em cache já o contém", () => {
    // A nota dele no cache (30) está velha; a ao vivo é 65. Se a entrada velha
    // ficasse, o tamanho seria 6 e ele apareceria duas vezes.
    const comEle = [...amostra, par(99, 30, 30)];
    const r = calcularPercentilSistema("atleta-99", { x: 65, y: 20 }, comEle);
    expect(r?.sampleSize).toBe(5);
    expect(r).toEqual(calcularPercentilSistema("eu", { x: 65, y: 20 }, amostra));
  });

  it("amostra de 4 mais ele mesmo já basta; só ele mesmo na amostra não", () => {
    expect(calcularPercentilSistema("atleta-1", { x: 50, y: 50 }, [par(1, 40, 40)])).toBeNull();
  });

  it("não devolve nenhum campo além dos três números", () => {
    const r = calcularPercentilSistema("eu", { x: 50, y: 50 }, amostra);
    expect(Object.keys(r as object).sort()).toEqual(["attackPercentile", "defensePercentile", "sampleSize"]);
  });
});

describe("derivarNuvens", () => {
  const pares = [
    { category: "Sub-15", attack: 60, defense: 40 },
    { category: "Sub-15", attack: 70, defense: 45 },
    { category: "Sub-17", attack: 80, defense: 55 },
    { category: null, attack: 50, defense: 50 },
  ];

  it("a nuvem do clube tem todos os pares, só com x e y", () => {
    const { clubCloud } = derivarNuvens(pares, "Sub-15");
    expect(clubCloud).toEqual([
      { x: 60, y: 40 },
      { x: 70, y: 45 },
      { x: 80, y: 55 },
      { x: 50, y: 50 },
    ]);
  });

  it("a nuvem do sub filtra pela categoria em memória", () => {
    const { categoryCloud } = derivarNuvens(pares, "Sub-15");
    expect(categoryCloud).toEqual([
      { x: 60, y: 40 },
      { x: 70, y: 45 },
    ]);
  });

  it("nenhum ponto carrega categoria, id ou qualquer outro campo", () => {
    const { categoryCloud, clubCloud } = derivarNuvens(pares, "Sub-15");
    for (const ponto of [...categoryCloud, ...clubCloud]) {
      expect(Object.keys(ponto).sort()).toEqual(["x", "y"]);
    }
  });

  it("sem categoria, o sub é o clube inteiro (comportamento anterior)", () => {
    const { categoryCloud, clubCloud } = derivarNuvens(pares, null);
    expect(categoryCloud).toEqual(clubCloud);
  });

  it("categoria sem ninguém devolve nuvem vazia do sub", () => {
    expect(derivarNuvens(pares, "Sub-11").categoryCloud).toEqual([]);
  });

  it("clube sem colegas devolve nuvens vazias", () => {
    expect(derivarNuvens([], "Sub-15")).toEqual({ categoryCloud: [], clubCloud: [] });
  });
});
