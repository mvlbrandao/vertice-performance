import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarSupabaseFalso, idFalso, type Linha } from "@/lib/testing/supabaseFalso";

// Leituras de contrato contra o Supabase falso compartilhado (que reproduz o
// corte de 1000 linhas do PostgREST). Ele não conhece maybeSingle nem like, por
// isso cada teste embrulha o cliente com o que falta (embrulhar), sem mexer no
// arquivo compartilhado.

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import {
  getActiveContractsByClub,
  getContractWithClub,
  isMissingRelation,
  listAllContracts,
  listClubContracts,
  listClubsForContracts,
  listContractAuditTrail,
} from "@/lib/platform/contracts";

type Falso = ReturnType<typeof criarSupabaseFalso>;

interface Embrulho {
  selects: { tabela: string; colunas: string }[];
  /** Tabelas que respondem com este erro em qualquer consulta. */
  erros: Record<string, { code?: string; message: string }>;
}

function embrulhar(falso: Falso, embrulho: Embrulho) {
  const original = (falso.client as unknown as { from: (t: string) => Record<string, unknown> }).from;
  return {
    from(tabela: string) {
      const erro = embrulho.erros[tabela];
      if (erro) {
        // Qualquer encadeamento termina no mesmo erro, como o servidor respondendo 4xx.
        const resposta = { data: null, error: erro };
        const toque: object = new Proxy(
          {},
          {
            get(_alvo, prop) {
              if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(resposta).then(res);
              return () => toque;
            },
          },
        );
        return toque;
      }

      const builder = original(tabela) as Record<string, (...args: unknown[]) => unknown>;
      const select = builder.select;
      builder.select = (...args: unknown[]) => {
        embrulho.selects.push({ tabela, colunas: String(args[0] ?? "") });
        return select.apply(builder, args);
      };
      // maybeSingle: zero linhas é null sem erro; mais de uma é erro.
      builder.maybeSingle = () => ({
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(builder as unknown as PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>)
            .then((r) => {
              if (r.error) return r;
              const linhas = r.data ?? [];
              if (linhas.length > 1) return { data: null, error: { message: "multiple rows" } };
              return { data: linhas[0] ?? null, error: null };
            })
            .then(resolve, reject),
      });
      return builder;
    },
  };
}

let embrulho: Embrulho;

function usar(tabelas: Record<string, Linha[]>) {
  const falso = criarSupabaseFalso(tabelas);
  embrulho = { selects: [], erros: {} };
  h.client = embrulhar(falso, embrulho);
  return falso;
}

const CLUBE = idFalso("aaaaaaaa", 1);

function contrato(n: number, over: Linha = {}): Linha {
  return {
    id: idFalso("cccccccc", n),
    number: n,
    club_id: idFalso("aaaaaaaa", (n % 7) + 1),
    status: "encerrado",
    // Datas distintas e ordenáveis como texto.
    starts_on: `2026-${String((n % 12) + 1).padStart(2, "0")}-${String((n % 28) + 1).padStart(2, "0")}`,
    ...over,
  };
}

function clube(n: number, over: Linha = {}): Linha {
  return {
    id: idFalso("aaaaaaaa", n),
    name: `Clube ${String(n).padStart(5, "0")}`,
    slug: `clube-${n}`,
    status: "ativo",
    // Colunas que NUNCA devem sair daqui: o falso as devolve se a consulta pedir "*".
    billing_cpf_cnpj: "12345678900",
    ...over,
  };
}

beforeEach(() => {
  h.client = null;
});

describe("isMissingRelation", () => {
  it("reconhece os códigos e mensagens de tabela ausente", () => {
    expect(isMissingRelation({ code: "PGRST205" })).toBe(true);
    expect(isMissingRelation({ code: "42P01" })).toBe(true);
    expect(isMissingRelation({ message: 'relation "club_contracts" does not exist' })).toBe(true);
    expect(isMissingRelation({ message: "Could not find the table 'public.club_contracts' in the schema cache" })).toBe(true);
  });

  it("outro erro, ou nenhum, não é tabela ausente", () => {
    expect(isMissingRelation(null)).toBe(false);
    expect(isMissingRelation({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingRelation({})).toBe(false);
  });
});

describe("listAllContracts: sem estourar o limite de 1000 linhas", () => {
  it("lê tudo em páginas: 2.500 contratos chegam inteiros", async () => {
    const falso = usar({ club_contracts: Array.from({ length: 2500 }, (_, i) => contrato(i + 1)) });
    const r = await listAllContracts();
    expect(r.migrationPending).toBe(false);
    expect(r.data).toHaveLength(2500);
    expect(new Set(r.data.map((c) => c.id)).size).toBe(2500);
    expect(falso.contar("club_contracts")).toBe(3);
  });

  it("mais recentes primeiro (início, depois número)", async () => {
    usar({
      club_contracts: [
        contrato(1, { starts_on: "2026-01-01" }),
        contrato(2, { starts_on: "2026-03-01" }),
        contrato(3, { starts_on: "2026-03-01" }),
      ],
    });
    const r = await listAllContracts();
    expect(r.data.map((c) => c.number)).toEqual([3, 2, 1]);
  });

  it("exatamente 1000: pede a página seguinte para ter certeza, e não duplica nem perde", async () => {
    const falso = usar({ club_contracts: Array.from({ length: 1000 }, (_, i) => contrato(i + 1)) });
    const r = await listAllContracts();
    expect(r.data).toHaveLength(1000);
    expect(falso.contar("club_contracts")).toBe(2);
  });

  it("tabela vazia", async () => {
    usar({ club_contracts: [] });
    expect(await listAllContracts()).toEqual({ data: [], migrationPending: false });
  });

  it("migração pendente vira aviso, não exceção", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "42P01", message: 'relation "club_contracts" does not exist' };
    expect(await listAllContracts()).toEqual({ data: [], migrationPending: true });
  });

  it("erro de leitura estoura (lista parcial como se fosse completa faria os indicadores mentirem)", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "57014", message: "canceling statement due to statement timeout" };
    await expect(listAllContracts()).rejects.toThrow("Falha ao ler contratos");
  });
});

describe("getActiveContractsByClub", () => {
  it("devolve só os vigentes, por clube, mesmo passando de 1000 linhas", async () => {
    const vigentes = Array.from({ length: 1200 }, (_, i) => contrato(i + 1, { status: "vigente", club_id: idFalso("dddddddd", i + 1) }));
    const outros = Array.from({ length: 1500 }, (_, i) => contrato(2000 + i, { status: "encerrado" }));
    usar({ club_contracts: [...vigentes, ...outros] });
    const r = await getActiveContractsByClub();
    expect(r.migrationPending).toBe(false);
    expect(r.data.size).toBe(1200);
    expect(r.data.get(idFalso("dddddddd", 5))?.number).toBe(5);
    expect([...r.data.values()].every((c) => c.status === "vigente")).toBe(true);
  });

  it("migração pendente", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "PGRST205", message: "Could not find the table 'public.club_contracts'" };
    const r = await getActiveContractsByClub();
    expect(r.migrationPending).toBe(true);
    expect(r.data.size).toBe(0);
  });
});

describe("listClubsForContracts", () => {
  it("lê todos os clubes, por nome, e pede só as colunas que a tela usa (sem CPF/CNPJ)", async () => {
    usar({ clubs: Array.from({ length: 1500 }, (_, i) => clube(1500 - i)) });
    const r = await listClubsForContracts();
    expect(r).toHaveLength(1500);
    expect(r[0].name).toBe("Clube 00001");
    expect(r[1499].name).toBe("Clube 01500");

    const colunas = embrulho.selects.filter((s) => s.tabela === "clubs").map((s) => s.colunas);
    expect(colunas.length).toBeGreaterThan(0);
    for (const c of colunas) {
      expect(c).not.toContain("*");
      expect(c).not.toMatch(/cpf|cnpj|email|asaas|billing/i);
      expect(c).toContain("price_cents_override");
    }
  });

  it("falha de leitura estoura: contrato sem dono seria pior que erro", async () => {
    usar({ clubs: [clube(1)] });
    embrulho.erros.clubs = { message: "boom" };
    await expect(listClubsForContracts()).rejects.toThrow("Falha ao ler os clubes");
  });
});

describe("getContractWithClub", () => {
  it("id malformado devolve null sem ir ao banco", async () => {
    const falso = usar({ club_contracts: [contrato(1)] });
    for (const id of ["", "123", "../etc/passwd", "ZZZZZZZZ-0000-4000-8000-000000000001", `${idFalso("cccccccc", 1)}x`]) {
      expect(await getContractWithClub(id)).toEqual({ data: null, migrationPending: false });
    }
    expect(falso.contar()).toBe(0);
  });

  it("devolve o contrato com o clube (e só as colunas seguras do clube)", async () => {
    usar({ club_contracts: [contrato(1, { club_id: CLUBE })], clubs: [clube(1)] });
    const r = await getContractWithClub(idFalso("cccccccc", 1));
    expect(r.migrationPending).toBe(false);
    expect(r.data?.contract.number).toBe(1);
    expect(r.data?.club?.name).toBe("Clube 00001");
    const colunas = embrulho.selects.find((s) => s.tabela === "clubs")!.colunas;
    expect(colunas).not.toContain("*");
    expect(colunas).not.toMatch(/cpf|cnpj|email|asaas|billing/i);
  });

  it("contrato inexistente: null, sem erro", async () => {
    usar({ club_contracts: [], clubs: [] });
    expect(await getContractWithClub(idFalso("cccccccc", 99))).toEqual({ data: null, migrationPending: false });
  });

  it("clube já removido: o contrato vem com club null", async () => {
    usar({ club_contracts: [contrato(1, { club_id: idFalso("aaaaaaaa", 50) })], clubs: [] });
    const r = await getContractWithClub(idFalso("cccccccc", 1));
    expect(r.data?.contract.number).toBe(1);
    expect(r.data?.club).toBeNull();
  });

  it("migração pendente", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "42P01", message: 'relation "club_contracts" does not exist' };
    expect(await getContractWithClub(idFalso("cccccccc", 1))).toEqual({ data: null, migrationPending: true });
  });

  it("outro erro de leitura estoura", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "57014", message: "timeout" };
    await expect(getContractWithClub(idFalso("cccccccc", 1))).rejects.toThrow("Falha ao ler o contrato");
  });
});

describe("listClubContracts", () => {
  it("só os contratos do clube, mais recentes primeiro", async () => {
    usar({
      club_contracts: [
        contrato(1, { club_id: CLUBE, starts_on: "2026-01-01" }),
        contrato(2, { club_id: CLUBE, starts_on: "2026-06-01" }),
        contrato(3, { club_id: idFalso("aaaaaaaa", 2), starts_on: "2026-12-01" }),
      ],
    });
    const r = await listClubContracts(CLUBE);
    expect(r.data.map((c) => c.number)).toEqual([2, 1]);
  });

  it("migração pendente", async () => {
    usar({});
    embrulho.erros.club_contracts = { code: "PGRST205", message: "Could not find the table" };
    expect(await listClubContracts(CLUBE)).toEqual({ data: [], migrationPending: true });
  });
});

describe("listContractAuditTrail", () => {
  /** Registra a cadeia de chamadas e responde com o que o teste configurar. */
  function gravador(resposta: { data: unknown[] | null; error: { code?: string; message: string } | null }) {
    const chamadas: [string, unknown[]][] = [];
    const toque: object = new Proxy(
      {},
      {
        get(_alvo, prop: string) {
          if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(resposta).then(res);
          return (...args: unknown[]) => {
            chamadas.push([prop, args]);
            return toque;
          };
        },
      },
    );
    h.client = { from: (tabela: string) => (chamadas.push(["from", [tabela]]), toque) };
    return chamadas;
  }

  it("filtra pelo clube e só por ações contract.*, mais novas primeiro, limitado", async () => {
    const chamadas = gravador({ data: [{ id: "1" }], error: null });
    const r = await listContractAuditTrail(CLUBE);
    expect(r).toEqual({ data: [{ id: "1" }], migrationPending: false });
    expect(chamadas).toContainEqual(["from", ["platform_audit_log"]]);
    expect(chamadas).toContainEqual(["eq", ["target_club_id", CLUBE]]);
    expect(chamadas).toContainEqual(["like", ["action", "contract.%"]]);
    expect(chamadas).toContainEqual(["order", ["occurred_at", { ascending: false }]]);
    expect(chamadas).toContainEqual(["limit", [30]]);
  });

  it("clube que não é uuid nem consulta", async () => {
    const chamadas = gravador({ data: [], error: null });
    expect(await listContractAuditTrail("não é uuid")).toEqual({ data: [], migrationPending: false });
    expect(chamadas).toEqual([]);
  });

  it("trilha ainda não existe (0072 pendente)", async () => {
    gravador({ data: null, error: { code: "42P01", message: 'relation "platform_audit_log" does not exist' } });
    expect(await listContractAuditTrail(CLUBE)).toEqual({ data: [], migrationPending: true });
  });

  it("outro erro estoura", async () => {
    gravador({ data: null, error: { message: "timeout" } });
    await expect(listContractAuditTrail(CLUBE)).rejects.toThrow("Falha ao ler a trilha");
  });
});
