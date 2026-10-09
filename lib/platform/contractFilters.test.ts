import { describe, expect, it } from "vitest";
import {
  contractsHref,
  filterContracts,
  hasActiveContractFilters,
  parseContractFilters,
  type ContractFilters,
  type FilterableContract,
} from "@/lib/platform/contractFilters";

const HOJE = "2026-10-08";

const TODOS: ContractFilters = { q: "", status: "todos", vencimento: "todos", ciclo: "todos", documento: "todos" };

function contrato(over: Partial<FilterableContract> & { number: number }): FilterableContract {
  return {
    status: "vigente",
    billing_cycle: "mensal",
    ends_on: null,
    document_path: null,
    club_name: "Clube Padrão",
    club_slug: "padrao",
    ...over,
  };
}

const lista: FilterableContract[] = [
  contrato({ number: 1, club_name: "São Paulo Futsal", club_slug: "sao-paulo-futsal", ends_on: "2026-10-20", document_path: "x/y/z.pdf" }),
  contrato({ number: 2, club_name: "Clube da Praia", club_slug: "praia", billing_cycle: "anual", ends_on: "2026-12-01" }),
  contrato({ number: 3, club_name: "Atlético Antigo", club_slug: "antigo", status: "encerrado", ends_on: "2026-09-01" }),
  contrato({ number: 10, club_name: "Vértice Demo", club_slug: "demo", status: "rascunho", ends_on: "2027-01-01" }),
  contrato({ number: 11, club_name: "Costa Azul", club_slug: "costa", billing_cycle: "trimestral", ends_on: "2026-10-01" }),
  contrato({ number: 12, club_name: "Sem Fim", club_slug: "sem-fim", ends_on: null }),
];

const numeros = (r: FilterableContract[]) => r.map((c) => c.number);

describe("parseContractFilters", () => {
  it("lê valores válidos", () => {
    expect(
      parseContractFilters({ q: " praia ", status: "vigente", vencimento: "30", ciclo: "anual", documento: "sem" }),
    ).toEqual({ q: "praia", status: "vigente", vencimento: "30", ciclo: "anual", documento: "sem" });
  });

  it("valor inválido ou ausente vira 'todos'", () => {
    expect(parseContractFilters({})).toEqual(TODOS);
    expect(
      parseContractFilters({ status: "hacker", vencimento: "999", ciclo: "diario", documento: "talvez" }),
    ).toEqual(TODOS);
  });

  it("usa o primeiro valor quando a URL repete o parâmetro", () => {
    expect(parseContractFilters({ status: ["rascunho", "vigente"], q: ["a", "b"] })).toMatchObject({
      status: "rascunho",
      q: "a",
    });
  });

  it("limita a busca a 80 caracteres", () => {
    expect(parseContractFilters({ q: "x".repeat(500) }).q).toHaveLength(80);
  });

  it("aceita 'vencidos' e rejeita variações de caixa", () => {
    expect(parseContractFilters({ vencimento: "vencidos" }).vencimento).toBe("vencidos");
    expect(parseContractFilters({ vencimento: "VENCIDOS" }).vencimento).toBe("todos");
  });
});

describe("hasActiveContractFilters e contractsHref", () => {
  it("detecta filtro ativo", () => {
    expect(hasActiveContractFilters(TODOS)).toBe(false);
    expect(hasActiveContractFilters({ ...TODOS, q: "a" })).toBe(true);
    expect(hasActiveContractFilters({ ...TODOS, documento: "sem" })).toBe(true);
    expect(hasActiveContractFilters({ ...TODOS, ciclo: "anual" })).toBe(true);
  });

  it("monta a URL só com o que filtra", () => {
    expect(contractsHref({})).toBe("/admin/contratos");
    expect(contractsHref(TODOS)).toBe("/admin/contratos");
    expect(contractsHref({ status: "vigente", vencimento: "30" })).toBe("/admin/contratos?status=vigente&vencimento=30");
    expect(contractsHref({ q: "são paulo", documento: "sem" })).toBe("/admin/contratos?q=s%C3%A3o+paulo&documento=sem");
  });

  it("a URL gerada volta igual ao ser lida", () => {
    const filtros: ContractFilters = { q: "a&b=c", status: "rascunho", vencimento: "vencidos", ciclo: "semestral", documento: "sem" };
    const params = new URL(`http://x${contractsHref(filtros)}`).searchParams;
    expect(
      parseContractFilters({
        q: params.get("q") ?? undefined,
        status: params.get("status") ?? undefined,
        vencimento: params.get("vencimento") ?? undefined,
        ciclo: params.get("ciclo") ?? undefined,
        documento: params.get("documento") ?? undefined,
      }),
    ).toEqual(filtros);
  });
});

describe("filterContracts: situação, ciclo e documento", () => {
  it("sem filtro devolve tudo na ordem recebida", () => {
    expect(numeros(filterContracts(lista, TODOS, HOJE))).toEqual([1, 2, 3, 10, 11, 12]);
  });

  it("filtra por situação", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, status: "rascunho" }, HOJE))).toEqual([10]);
    expect(numeros(filterContracts(lista, { ...TODOS, status: "encerrado" }, HOJE))).toEqual([3]);
    expect(numeros(filterContracts(lista, { ...TODOS, status: "cancelado" }, HOJE))).toEqual([]);
  });

  it("filtra por ciclo", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, ciclo: "anual" }, HOJE))).toEqual([2]);
    expect(numeros(filterContracts(lista, { ...TODOS, ciclo: "trimestral" }, HOJE))).toEqual([11]);
  });

  it("'sem documento' tira quem tem PDF anexado", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, documento: "sem" }, HOJE))).toEqual([2, 3, 10, 11, 12]);
  });

  it("combina filtros (E, não OU)", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, status: "vigente", ciclo: "mensal", documento: "sem" }, HOJE))).toEqual([12]);
  });
});

describe("filterContracts: vencimento", () => {
  it("vencem em 30 dias: só vigente, de hoje a +30, ordenado pelo que acaba primeiro", () => {
    // CT-1 vence em 12 dias. CT-11 já venceu (01/10). CT-2 em 54 dias. CT-3 é encerrado.
    expect(numeros(filterContracts(lista, { ...TODOS, vencimento: "30" }, HOJE))).toEqual([1]);
  });

  it("60 e 90 são cumulativos", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, vencimento: "60" }, HOJE))).toEqual([1, 2]);
    expect(numeros(filterContracts(lista, { ...TODOS, vencimento: "90" }, HOJE))).toEqual([1, 2]);
  });

  it("vencidos: vigente cujo fim já passou", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, vencimento: "vencidos" }, HOJE))).toEqual([11]);
  });

  it("encerrado, rascunho e prazo indeterminado nunca entram no filtro de vencimento", () => {
    for (const v of ["30", "60", "90", "vencidos"] as const) {
      const r = numeros(filterContracts(lista, { ...TODOS, vencimento: v }, HOJE));
      expect(r).not.toContain(3);
      expect(r).not.toContain(10);
      expect(r).not.toContain(12);
    }
  });

  it("fronteira: vence hoje entra em 30 (e não em vencidos); vencido ontem só em vencidos", () => {
    const hoje = [contrato({ number: 1, ends_on: HOJE })];
    const ontem = [contrato({ number: 2, ends_on: "2026-10-07" })];
    expect(filterContracts(hoje, { ...TODOS, vencimento: "30" }, HOJE)).toHaveLength(1);
    expect(filterContracts(hoje, { ...TODOS, vencimento: "vencidos" }, HOJE)).toHaveLength(0);
    expect(filterContracts(ontem, { ...TODOS, vencimento: "30" }, HOJE)).toHaveLength(0);
    expect(filterContracts(ontem, { ...TODOS, vencimento: "vencidos" }, HOJE)).toHaveLength(1);
  });

  it("fronteira de 30 dias: +30 entra, +31 não", () => {
    const c30 = [contrato({ number: 1, ends_on: "2026-11-07" })];
    const c31 = [contrato({ number: 2, ends_on: "2026-11-08" })];
    expect(filterContracts(c30, { ...TODOS, vencimento: "30" }, HOJE)).toHaveLength(1);
    expect(filterContracts(c31, { ...TODOS, vencimento: "30" }, HOJE)).toHaveLength(0);
    expect(filterContracts(c31, { ...TODOS, vencimento: "60" }, HOJE)).toHaveLength(1);
  });

  it("desempata pelo número quando o fim é o mesmo", () => {
    const iguais = [
      contrato({ number: 9, ends_on: "2026-10-20" }),
      contrato({ number: 4, ends_on: "2026-10-20" }),
      contrato({ number: 7, ends_on: "2026-10-10" }),
    ];
    expect(numeros(filterContracts(iguais, { ...TODOS, vencimento: "30" }, HOJE))).toEqual([7, 4, 9]);
  });

  it("não altera a lista de entrada", () => {
    const copia = [...lista];
    filterContracts(lista, { ...TODOS, vencimento: "90" }, HOJE);
    expect(lista).toEqual(copia);
  });
});

describe("filterContracts: busca", () => {
  it("por nome do clube, sem acento nem caixa", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, q: "SAO paulo" }, HOJE))).toEqual([1]);
    expect(numeros(filterContracts(lista, { ...TODOS, q: "vertice" }, HOJE))).toEqual([10]);
    expect(numeros(filterContracts(lista, { ...TODOS, q: "atletico" }, HOJE))).toEqual([3]);
  });

  it("pelo endereço (slug) do clube", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, q: "praia" }, HOJE))).toEqual([2]);
  });

  it("pelo número do contrato: 'CT-1', 'ct1' e '1' acham o 1, e não o 10 nem o 11", () => {
    for (const q of ["CT-1", "ct1", "1", " ct-1 "]) {
      expect(numeros(filterContracts(lista, { ...TODOS, q }, HOJE)), q).toEqual([1]);
    }
    expect(numeros(filterContracts(lista, { ...TODOS, q: "CT-10" }, HOJE))).toEqual([10]);
  });

  it("número sem contrato correspondente não cai em busca por texto", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, q: "999" }, HOJE))).toEqual([]);
  });

  it("busca sem resultado devolve vazio", () => {
    expect(filterContracts(lista, { ...TODOS, q: "inexistente" }, HOJE)).toEqual([]);
  });

  it("busca combina com os outros filtros", () => {
    expect(numeros(filterContracts(lista, { ...TODOS, q: "praia", status: "rascunho" }, HOJE))).toEqual([]);
    expect(numeros(filterContracts(lista, { ...TODOS, q: "praia", status: "vigente" }, HOJE))).toEqual([2]);
  });
});
