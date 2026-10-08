import { describe, expect, it } from "vitest";
import { filterClubs, normalizeSearch, parseClubFilters } from "./clubFilters";
import type { ClubStatus } from "@/lib/types/database";

const clubs: { name: string; slug: string; status: ClubStatus }[] = [
  { name: "São Paulo Futsal", slug: "sao-paulo-futsal", status: "ativo" },
  { name: "Vértice Demo", slug: "demo", status: "ativo" },
  { name: "Clube da Praia", slug: "praia", status: "trial" },
  { name: "Atlético Antigo", slug: "antigo", status: "cancelado" },
];

describe("parseClubFilters", () => {
  it("lê busca e situação válidas", () => {
    expect(parseClubFilters({ q: "  praia ", status: "trial" })).toEqual({
      q: "praia",
      status: "trial",
    });
  });

  it("situação inválida ou ausente vira todos", () => {
    expect(parseClubFilters({}).status).toBe("todos");
    expect(parseClubFilters({ status: "hacker" }).status).toBe("todos");
    expect(parseClubFilters({ status: "todos" }).status).toBe("todos");
  });

  it("usa o primeiro valor quando a URL repete o parâmetro", () => {
    expect(parseClubFilters({ q: ["a", "b"], status: ["ativo", "trial"] })).toEqual({
      q: "a",
      status: "ativo",
    });
  });

  it("limita o tamanho da busca", () => {
    expect(parseClubFilters({ q: "x".repeat(500) }).q).toHaveLength(80);
  });
});

describe("normalizeSearch", () => {
  it("tira acento e caixa", () => {
    expect(normalizeSearch("  São PAULO ")).toBe("sao paulo");
    expect(normalizeSearch("Vértice")).toBe("vertice");
  });
});

describe("filterClubs", () => {
  it("sem filtro devolve tudo", () => {
    expect(filterClubs(clubs, { q: "", status: "todos" })).toHaveLength(4);
  });

  it("busca por nome sem acento nem caixa", () => {
    expect(filterClubs(clubs, { q: "sao paulo", status: "todos" }).map((c) => c.slug)).toEqual([
      "sao-paulo-futsal",
    ]);
    expect(filterClubs(clubs, { q: "VERTICE", status: "todos" })).toHaveLength(1);
  });

  it("busca também pelo endereço (slug)", () => {
    expect(filterClubs(clubs, { q: "praia", status: "todos" })).toHaveLength(1);
  });

  it("filtra por situação e combina com a busca", () => {
    expect(filterClubs(clubs, { q: "", status: "ativo" })).toHaveLength(2);
    expect(filterClubs(clubs, { q: "demo", status: "ativo" })).toHaveLength(1);
    expect(filterClubs(clubs, { q: "demo", status: "trial" })).toHaveLength(0);
  });

  it("não altera a lista original", () => {
    const copia = [...clubs];
    filterClubs(clubs, { q: "x", status: "trial" });
    expect(clubs).toEqual(copia);
  });
});
