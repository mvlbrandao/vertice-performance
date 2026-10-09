import { beforeEach, describe, expect, it, vi } from "vitest";

// Ações de contrato contra um Supabase falso em memória. O falso daqui conhece
// só o que as ações usam, mas reproduz o que importa para provar as regras:
// o índice único parcial (um contrato vigente por clube, erro 23505), a
// numeração (identity), o filtro por status nos updates e o storage
// (URL assinada de envio, info do objeto, remoção, link assinado).
//
// Limite do falso: não há transação nem isolamento. A corrida entre duas
// ativações é simulada por um gancho que grava um segundo vigente NO MEIO da
// ação, exatamente a janela que o índice único existe para fechar.

vi.mock("server-only", () => ({}));

type Linha = Record<string, unknown>;
type Erro = { code?: string; message: string };

const h = vi.hoisted(() => ({
  isAdmin: true,
  recorded: true,
  logs: [] as { action: string; club?: { id: string; name: string | null }; details?: Record<string, unknown> }[],
  events: [] as string[],
  revalidated: 0,
  // Banco
  tables: {} as Record<string, Linha[]>,
  nextNumber: 1,
  nextId: 1,
  dbCalls: [] as string[],
  /** Chamado antes de cada escrita; pode gravar uma linha concorrente ou devolver um erro. */
  beforeWrite: null as null | ((op: string, table: string, patch: Linha) => Erro | null | void),
  // Storage
  bucketMissing: false,
  objects: new Map<string, { size: number; contentType: string }>(),
  tickets: [] as string[],
  removed: [] as string[],
  signed: [] as { path: string; ttl: number; options: unknown }[],
  storageCalls: 0,
  removeFails: false,
  // RPC platform_activate_contract (0076): 'ausente' = função não existe (cai no plano B
  // sequencial, como nos testes antigos); 'atomica' = emula a função SQL; 'erro' = falha do banco.
  rpcMode: "ausente" as "ausente" | "atomica" | "erro",
  rpcCalls: [] as string[],
  rpcAtomicFail: false,
  /** Roda no começo da RPC: simula alguém mexendo no contrato entre a checagem e a chamada. */
  beforeRpc: null as null | (() => void),
}));

vi.mock("@/lib/platform/admin", () => ({
  requirePlatformAdmin: async () => {
    if (!h.isAdmin) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    return { userId: "u-1", email: "dono@exemplo.com", fullName: "Dono" };
  },
}));
vi.mock("@/lib/platform/audit", () => ({
  logPlatformAction: async (entry: (typeof h.logs)[number]) => {
    h.events.push(`log:${entry.action}`);
    h.logs.push(entry);
    return h.recorded;
  },
}));
vi.mock("@/lib/platform/revalidate", () => ({
  revalidateAdmin: () => {
    h.revalidated += 1;
  },
}));

vi.mock("@/lib/supabase/admin", () => {
  const uuid = () => {
    const n = h.nextId++;
    return `c0ffee00-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };

  function violatesActiveIndex(table: string, rows: Linha[], candidate: Linha): boolean {
    if (table !== "club_contracts" || candidate.status !== "vigente") return false;
    return rows.some((r) => r.id !== candidate.id && r.club_id === candidate.club_id && r.status === "vigente");
  }

  function from(table: string) {
    const filters: ((r: Linha) => boolean)[] = [];
    let op: "select" | "insert" | "update" = "select";
    let patch: Linha = {};
    let insertRow: Linha = {};
    let returning = false;
    let shape: "many" | "maybe" | "one" = "many";

    function execute(): { data: unknown; error: Erro | null } {
      h.dbCalls.push(`${op}:${table}`);
      const rows = (h.tables[table] ??= []);

      if (op !== "select") {
        h.events.push(`${op}:${table}`);
        const hook = h.beforeWrite?.(op, table, op === "insert" ? insertRow : patch);
        if (hook) return { data: null, error: hook };
      }

      if (op === "insert") {
        const row: Linha = {
          id: uuid(),
          status: "rascunho",
          max_athletes: null,
          ends_on: null,
          document_path: null,
          closed_at: null,
          closed_reason: null,
          created_at: "2026-10-08T12:00:00Z",
          updated_at: "2026-10-08T12:00:00Z",
          signed_on: null,
          signer_name: null,
          signer_role: null,
          terms_version: null,
          notes: null,
          ...insertRow,
        };
        if (table === "club_contracts") row.number = h.nextNumber++;
        if (violatesActiveIndex(table, rows, row)) {
          return {
            data: null,
            error: {
              code: "23505",
              message: 'duplicate key value violates unique constraint "club_contracts_one_active_per_club"',
            },
          };
        }
        rows.push(row);
        // Cópia, como o PostgREST: quem lê não pode enxergar mutações posteriores.
        return { data: structuredClone(shape === "one" ? row : [row]), error: null };
      }

      const matching = rows.filter((r) => filters.every((f) => f(r)));

      if (op === "update") {
        const staged = matching.map((r) => ({ ...r, ...patch }));
        for (const i of matching.keys()) {
          if (violatesActiveIndex(table, rows, staged[i])) {
            return {
              data: null,
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "club_contracts_one_active_per_club"',
              },
            };
          }
        }
        for (const [i, r] of matching.entries()) Object.assign(r, staged[i]);
        return { data: returning ? structuredClone(matching) : null, error: null };
      }

      if (shape === "maybe") {
        if (matching.length > 1) return { data: null, error: { message: "JSON object requested, multiple rows returned" } };
        return { data: structuredClone(matching[0] ?? null), error: null };
      }
      return { data: structuredClone(matching), error: null };
    }

    const api = {
      select: () => {
        returning = true;
        return api;
      },
      insert: (row: Linha) => {
        op = "insert";
        insertRow = row;
        return api;
      },
      update: (p: Linha) => {
        op = "update";
        patch = p;
        return api;
      },
      eq: (col: string, value: unknown) => {
        filters.push((r) => r[col] === value);
        return api;
      },
      in: (col: string, values: unknown[]) => {
        filters.push((r) => values.includes(r[col]));
        return api;
      },
      maybeSingle: () => {
        shape = "maybe";
        return api;
      },
      single: () => {
        shape = "one";
        return api;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(execute()).then(resolve, reject),
    };
    return api;
  }

  const storage = {
    from: (bucket: string) => {
      if (bucket !== "club-contracts") throw new Error(`bucket inesperado: ${bucket}`);
      const missing = { data: null, error: { message: "Bucket not found" } };
      return {
        createSignedUploadUrl: async (path: string) => {
          h.storageCalls += 1;
          if (h.bucketMissing) return missing;
          h.tickets.push(path);
          return { data: { signedUrl: `https://storage.test/upload/${path}?token=tok-1`, token: "tok-1", path }, error: null };
        },
        info: async (path: string) => {
          h.storageCalls += 1;
          if (h.bucketMissing) return missing;
          const obj = h.objects.get(path);
          return obj
            ? { data: { name: path, size: obj.size, contentType: obj.contentType }, error: null }
            : { data: null, error: { message: "Object not found" } };
        },
        remove: async (paths: string[]) => {
          h.storageCalls += 1;
          if (h.removeFails) return { data: null, error: { message: "falha ao remover" } };
          for (const p of paths) {
            h.removed.push(p);
            h.objects.delete(p);
          }
          return { data: [], error: null };
        },
        createSignedUrl: async (path: string, ttl: number, options?: unknown) => {
          h.storageCalls += 1;
          if (h.bucketMissing) return missing;
          h.signed.push({ path, ttl, options });
          return { data: { signedUrl: `https://storage.test/sign/${path}?t=1` }, error: null };
        },
      };
    },
  };

  async function rpc(
    name: string,
    args: { p_contract_id: string; p_replace?: boolean; p_closed_reason?: string | null },
  ): Promise<{ data: unknown; error: Erro | null }> {
    h.rpcCalls.push(name);
    h.beforeRpc?.();
    if (h.rpcMode === "ausente") {
      return {
        data: null,
        error: { code: "PGRST202", message: `Could not find the function public.${name}(p_closed_reason, p_contract_id, p_replace) in the schema cache` },
      };
    }
    if (h.rpcMode === "erro") {
      return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    }
    // Emula a função SQL: uma transação, então tudo ou nada.
    const rows = (h.tables.club_contracts ??= []);
    const novo = rows.find((r) => r.id === args.p_contract_id);
    if (!novo) return { data: { ok: false, code: "not_found" }, error: null };
    if (novo.status !== "rascunho") return { data: { ok: false, code: "not_draft", status: novo.status }, error: null };
    const antigo = rows.find((r) => r.club_id === novo.club_id && r.status === "vigente");
    if (antigo && !args.p_replace) {
      return { data: { ok: false, code: "has_active", active_id: antigo.id, active_number: antigo.number }, error: null };
    }
    if (h.rpcAtomicFail) return { data: null, error: { message: "falha simulada ao ativar" } }; // nada foi alterado
    if (antigo) {
      Object.assign(antigo, {
        status: "encerrado",
        closed_at: "2026-10-09T12:00:00Z",
        closed_reason: args.p_closed_reason || `Substituído pelo CT-${novo.number}`,
      });
    }
    novo.status = "vigente";
    return {
      data: {
        ok: true,
        club_id: novo.club_id,
        number: novo.number,
        replaced_id: antigo ? antigo.id : null,
        replaced_number: antigo ? antigo.number : null,
      },
      error: null,
    };
  }

  return { createAdminClient: () => ({ from, storage, rpc }) };
});

import * as actions from "./contracts";
import { AUDIT_NOT_RECORDED_WARNING } from "@/lib/platform/auditNotice";
import { MAX_DOCUMENT_BYTES } from "@/lib/platform/contractDocumentPath";

const {
  activateContract,
  cancelContract,
  closeContract,
  confirmContractDocument,
  createContract,
  getContractDocumentUrl,
  removeContractDocument,
  renewContract,
  requestContractDocumentUpload,
  updateContract,
} = actions;

const CLUB_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CLUB_B = "bbbbbbbb-0000-4000-8000-000000000002";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const campos = {
  planName: "Plano Clube",
  priceReais: "149,90",
  maxAthletes: "",
  billingCycle: "mensal",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  autoRenew: "true",
  signedOn: "",
  signerName: "",
  signerRole: "",
  termsVersion: "",
  notes: "",
};

const novo = (over: Record<string, string> = {}) => form({ clubId: CLUB_A, ...campos, ...over });

function linhas(): Linha[] {
  return h.tables.club_contracts;
}
function porNumero(n: number): Linha {
  const l = linhas().find((r) => r.number === n);
  if (!l) throw new Error(`CT-${n} não existe no falso`);
  return l;
}

/** Contrato direto no falso (sem passar pelas ações), com número e id. */
function semear(over: Linha = {}): Linha {
  const number = h.nextNumber++;
  const row: Linha = {
    id: `d0d0d0d0-0000-4000-8000-${String(number).padStart(12, "0")}`,
    number,
    club_id: CLUB_A,
    status: "vigente",
    plan_name: "Plano Clube",
    price_cents: 14990,
    max_athletes: null,
    billing_cycle: "mensal",
    starts_on: "2026-10-01",
    ends_on: "2026-10-31",
    auto_renew: true,
    signed_on: null,
    signer_name: null,
    signer_role: null,
    terms_version: null,
    document_path: null,
    notes: null,
    closed_at: null,
    closed_reason: null,
    created_by_email: null,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    ...over,
  };
  linhas().push(row);
  return row;
}

const idDe = (row: Linha) => row.id as string;

beforeEach(() => {
  h.isAdmin = true;
  h.recorded = true;
  h.logs.length = 0;
  h.events.length = 0;
  h.revalidated = 0;
  h.tables = {
    clubs: [
      { id: CLUB_A, name: "Clube A" },
      { id: CLUB_B, name: "Clube B" },
    ],
    club_contracts: [],
  };
  h.nextNumber = 1;
  h.nextId = 1;
  h.dbCalls.length = 0;
  h.beforeWrite = null;
  h.bucketMissing = false;
  h.objects.clear();
  h.tickets.length = 0;
  h.removed.length = 0;
  h.signed.length = 0;
  h.storageCalls = 0;
  h.removeFails = false;
  h.rpcMode = "ausente";
  h.rpcCalls.length = 0;
  h.rpcAtomicFail = false;
  h.beforeRpc = null;
});

describe("toda ação começa por requirePlatformAdmin", () => {
  const chamadas: Record<string, () => Promise<unknown>> = {
    createContract: () => createContract(novo()),
    updateContract: () => updateContract(form({ contractId: "x" })),
    activateContract: () => activateContract(form({ contractId: "x" })),
    closeContract: () => closeContract(form({ contractId: "x", reason: "abc" })),
    cancelContract: () => cancelContract(form({ contractId: "x", reason: "abc" })),
    renewContract: () => renewContract(form({ contractId: "x" })),
    requestContractDocumentUpload: () => requestContractDocumentUpload("x"),
    confirmContractDocument: () => confirmContractDocument("x", "y"),
    removeContractDocument: () => removeContractDocument("x"),
    getContractDocumentUrl: () => getContractDocumentUrl("x"),
  };

  it("a lista cobre todas as ações exportadas (ação nova sem teste de portão falha aqui)", () => {
    expect(Object.keys(actions).sort()).toEqual(Object.keys(chamadas).sort());
  });

  for (const [nome, chamar] of Object.entries(chamadas)) {
    it(`${nome}: quem não é administrador é barrado antes de tocar em banco, storage ou trilha`, async () => {
      h.isAdmin = false;
      await expect(chamar()).rejects.toThrow("404");
      expect(h.dbCalls).toEqual([]);
      expect(h.storageCalls).toBe(0);
      expect(h.logs).toEqual([]);
      expect(h.revalidated).toBe(0);
    });
  }
});

describe("createContract", () => {
  it("cria o rascunho, numera, registra a trilha e revalida", async () => {
    const r = await createContract(novo());
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);
    expect(r.contractId).toBe(idDe(porNumero(1)));
    expect(linhas()).toHaveLength(1);
    expect(porNumero(1)).toMatchObject({
      club_id: CLUB_A,
      status: "rascunho",
      plan_name: "Plano Clube",
      price_cents: 14990,
      max_athletes: null,
      billing_cycle: "mensal",
      starts_on: "2026-10-01",
      ends_on: "2026-10-31",
      auto_renew: true,
      created_by_email: "dono@exemplo.com",
    });
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({
      action: "contract.create",
      club: { id: CLUB_A, name: "Clube A" },
      details: { contractId: idDe(porNumero(1)), number: 1 },
    });
    expect(h.revalidated).toBeGreaterThan(0);
  });

  it("a trilha da criação não leva o nome de quem assinou e trunca as notas longas", async () => {
    await createContract(novo({ signerName: "Maria da Silva", notes: "n".repeat(1500) }));
    const texto = JSON.stringify(h.logs[0].details);
    expect(texto).not.toContain("Maria da Silva");
    expect(texto).toContain("(omitido)");
    expect(texto).not.toContain("n".repeat(200));
    // O banco guarda o texto inteiro.
    expect(porNumero(1).notes).toBe("n".repeat(1500));
    expect(porNumero(1).signer_name).toBe("Maria da Silva");
  });

  it("entrada inválida volta com mensagem por campo e não toca no banco", async () => {
    const r = await createContract(novo({ planName: "", priceReais: "-3" }));
    expect(r.success).toBeUndefined();
    expect(r.error).toBeTruthy();
    expect(r.fieldErrors).toMatchObject({ planName: expect.any(String), priceReais: expect.any(String) });
    expect(h.dbCalls).toEqual([]);
    expect(h.logs).toEqual([]);
  });

  it("clube que não existe é recusado sem criar nada", async () => {
    const r = await createContract(novo({ clubId: "eeeeeeee-0000-4000-8000-000000000009" }));
    expect(r.error).toBe("Clube não encontrado.");
    expect(linhas()).toHaveLength(0);
  });

  it("criar já vigente num clube sem vigente: nasce e ativa", async () => {
    const r = await createContract(novo({ status: "vigente" }));
    expect(r.success).toBe(true);
    expect(porNumero(1).status).toBe("vigente");
    expect(h.logs.map((l) => l.action)).toEqual(["contract.create", "contract.activate"]);
  });

  it("criar vigente com outro vigente e SEM confirmar: recusa e não cria rascunho órfão", async () => {
    semear({ club_id: CLUB_A, status: "vigente" });
    const r = await createContract(novo({ status: "vigente" }));
    expect(r.error).toContain("CT-1");
    expect(r.needsReplaceConfirmation).toEqual({ currentNumber: 1 });
    expect(linhas()).toHaveLength(1);
    expect(porNumero(1).status).toBe("vigente");
    expect(h.logs).toEqual([]);
  });

  it("criar vigente confirmando: o antigo é encerrado como 'Substituído pelo CT-2'", async () => {
    semear({ club_id: CLUB_A, status: "vigente" });
    const r = await createContract(novo({ status: "vigente", replace: "true" }));
    expect(r.success).toBe(true);
    expect(porNumero(1)).toMatchObject({ status: "encerrado", closed_reason: "Substituído pelo CT-2" });
    expect(typeof porNumero(1).closed_at).toBe("string");
    expect(porNumero(2).status).toBe("vigente");
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(1);
  });

  it("vigente de OUTRO clube não atrapalha", async () => {
    semear({ club_id: CLUB_B, status: "vigente" });
    const r = await createContract(novo({ status: "vigente" }));
    expect(r.success).toBe(true);
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(2);
  });

  it("falha ao ativar logo após criar: o rascunho fica e a resposta leva até ele", async () => {
    h.beforeWrite = (op, _table, patch) => {
      if (op === "update" && patch.status === "vigente") return { message: "queda de rede" };
    };
    const r = await createContract(novo({ status: "vigente" }));
    expect(r.error).toContain("criado como rascunho");
    expect(r.contractId).toBe(idDe(porNumero(1)));
    expect(porNumero(1).status).toBe("rascunho");
  });

  it("tabela ausente (migração pendente) vira mensagem clara", async () => {
    h.beforeWrite = () => ({ code: "PGRST205", message: "Could not find the table 'public.club_contracts' in the schema cache" });
    const r = await createContract(novo());
    expect(r.error).toContain("migração 0073");
  });
});

describe("a trilha não gravou", () => {
  it("a ação vale, a tela recebe o aviso, e a trilha vem DEPOIS da mutação", async () => {
    h.recorded = false;
    const r = await createContract(novo());
    expect(r.success).toBe(true);
    expect(r.warning).toBe(AUDIT_NOT_RECORDED_WARNING);
    expect(linhas()).toHaveLength(1);
  });

  it("sem aviso quando a trilha grava", async () => {
    const r = await createContract(novo());
    expect(r.warning).toBeUndefined();
  });

  it("aviso também em ativar, encerrar, cancelar, renovar e editar", async () => {
    h.recorded = false;
    const rasc = semear({ status: "rascunho", club_id: CLUB_A });
    expect((await activateContract(form({ contractId: idDe(rasc) }))).warning).toBe(AUDIT_NOT_RECORDED_WARNING);
    expect((await updateContract(form({ contractId: idDe(rasc), ...campos, planName: "Novo plano" }))).warning).toBe(
      AUDIT_NOT_RECORDED_WARNING,
    );
    expect((await renewContract(form({ contractId: idDe(rasc) }))).warning).toBe(AUDIT_NOT_RECORDED_WARNING);
    expect((await closeContract(form({ contractId: idDe(rasc), reason: "fim do acordo" }))).warning).toBe(
      AUDIT_NOT_RECORDED_WARNING,
    );
    const outro = semear({ status: "rascunho", club_id: CLUB_B });
    expect((await cancelContract(form({ contractId: idDe(outro), reason: "desistiu" }))).warning).toBe(
      AUDIT_NOT_RECORDED_WARNING,
    );
  });

  it("a trilha só é gravada depois de a mutação acontecer", async () => {
    await createContract(novo());
    expect(h.events).toEqual(["insert:club_contracts", "log:contract.create"]);
  });

  it("mutação que falha não deixa rastro na trilha", async () => {
    const c = semear({ status: "vigente" });
    h.beforeWrite = (op) => (op === "update" ? { message: "queda de rede" } : undefined);
    const r = await closeContract(form({ contractId: idDe(c), reason: "terminou" }));
    expect(r.error).toBeTruthy();
    expect(h.logs).toEqual([]);
  });
});

describe("activateContract", () => {
  it("rascunho vira vigente quando o clube não tem outro", async () => {
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.success).toBe(true);
    expect(rasc.status).toBe("vigente");
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({
      action: "contract.activate",
      details: { number: 1, changes: { status: { from: "rascunho", to: "vigente" } } },
    });
  });

  it("segundo vigente SEM confirmação é recusado e nada muda", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.error).toContain("CT-1");
    expect(r.success).toBeUndefined();
    expect(r.needsReplaceConfirmation).toEqual({ currentNumber: 1 });
    expect(vig.status).toBe("vigente");
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toEqual([]);
  });

  it("com confirmação: substitui, encerra o antigo com closed_at e o motivo, e registra as duas pontas", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho", starts_on: "2026-11-01", ends_on: "2026-11-30" });
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(rasc.status).toBe("vigente");
    expect(vig).toMatchObject({ status: "encerrado", closed_reason: "Substituído pelo CT-2" });
    expect(Number.isNaN(Date.parse(String(vig.closed_at)))).toBe(false);
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(1);

    expect(h.logs.map((l) => l.action)).toEqual(["contract.activate", "contract.close"]);
    expect(h.logs[0].details).toMatchObject({ number: 2, replaces: 1 });
    expect(h.logs[1].details).toMatchObject({
      number: 1,
      replacedBy: 2,
      reason: "Substituído pelo CT-2",
      changes: { status: { from: "vigente", to: "encerrado" } },
    });
  });

  it("só rascunho ativa: encerrado, cancelado e vigente são recusados", async () => {
    for (const status of ["encerrado", "cancelado", "vigente"]) {
      const c = semear({ status, club_id: CLUB_B });
      const r = await activateContract(form({ contractId: idDe(c) }));
      expect(r.error, status).toContain("Só rascunho");
      expect(c.status).toBe(status);
      // limpa para o próximo não ver um vigente já existente
      linhas().length = 0;
    }
    expect(h.logs).toEqual([]);
  });

  it("id inexistente ou malformado", async () => {
    expect((await activateContract(form({ contractId: "nao-e-uuid" }))).error).toBe("Contrato inválido.");
    expect((await activateContract(form({ contractId: "c0ffee00-0000-4000-8000-0000000000ff" }))).error).toBe(
      "Contrato não encontrado.",
    );
  });

  it("corrida: outro vigente surge no meio da ativação (sem substituição) -> erro amigável, nada se perde", async () => {
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") {
        h.beforeWrite = null;
        // Outra aba ativou um contrato do mesmo clube entre a leitura e a gravação.
        semear({ status: "vigente", club_id: CLUB_A });
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.error).toContain("já tem um contrato vigente");
    expect(r.error).not.toContain("duplicate key");
    expect(rasc.status).toBe("rascunho");
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(1);
    expect(h.logs).toEqual([]);
  });

  it("corrida COM substituição: o antigo é reaberto se a ativação falha, e não sobra clube sem vigente", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    let falhas = 0;
    h.beforeWrite = (op, _t, patch) => {
      // Falha só a ativação do rascunho (a reabertura do antigo passa).
      if (op === "update" && patch.status === "vigente" && falhas === 0) {
        falhas += 1;
        return { code: "23505", message: 'duplicate key value violates unique constraint "club_contracts_one_active_per_club"' };
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toContain("já tem um contrato vigente");
    expect(vig.status).toBe("vigente");
    expect(vig.closed_reason).toBeNull();
    expect(vig.closed_at).toBeNull();
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toEqual([]);
  });

  it("se nem a reabertura funciona, a mensagem avisa que o antigo ficou encerrado", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") return { message: "queda de rede" };
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toContain("ATENÇÃO");
    expect(r.error).toContain("CT-1");
    expect(vig.status).toBe("encerrado");
  });

  it("o antigo mudou de situação no meio: recusa sem ativar o novo", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      // Alguém encerrou o antigo entre a leitura e a gravação.
      if (op === "update" && patch.status === "encerrado") {
        h.beforeWrite = null;
        vig.status = "encerrado";
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toContain("mudou de situação");
    expect(rasc.status).toBe("rascunho");
  });
});

describe("substituição sem transação: nunca grava um motivo falso", () => {
  const PROVISORIO = "Substituição pelo CT-2 em andamento";

  it("na janela entre encerrar o antigo e ativar o novo, o motivo é provisório, e o definitivo só vem depois", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    let motivoNaJanela: unknown = "não visto";
    let statusDoNovoNaJanela: unknown = "não visto";
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") {
        // Instante exato da ativação: o antigo já está encerrado, o novo ainda é rascunho.
        motivoNaJanela = vig.closed_reason;
        statusDoNovoNaJanela = rasc.status;
        h.beforeWrite = null;
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(motivoNaJanela).toBe(PROVISORIO);
    expect(statusDoNovoNaJanela).toBe("rascunho");
    expect(vig.closed_reason).toBe("Substituído pelo CT-2");
    expect(r.warning).toBeUndefined();
  });

  it("o processo cai entre as duas gravações: o antigo fica 'em andamento', nunca 'Substituído'", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") throw new Error("função encerrada pela plataforma");
    };
    await expect(activateContract(form({ contractId: idDe(rasc), replace: "true" }))).rejects.toThrow();
    expect(vig).toMatchObject({ status: "encerrado", closed_reason: PROVISORIO });
    expect(String(vig.closed_reason)).not.toMatch(/^Substituído/);
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toEqual([]);
  });

  it("corrida com reabertura impossível: o antigo diz o que houve e a trilha registra o encerramento", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") {
        h.beforeWrite = null;
        // Outra aba ativou o CT-3 do mesmo clube na janela: a ativação do CT-2 e a
        // reabertura do CT-1 batem as duas no índice único (reproduzido pelo falso).
        semear({ status: "vigente", club_id: CLUB_A });
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toContain("ATENÇÃO");
    expect(r.error).toContain("CT-1");
    expect(r.error).toContain("CT-2 não foi ativado");
    expect(vig.status).toBe("encerrado");
    expect(vig.closed_reason).not.toBe("Substituído pelo CT-2");
    expect(vig.closed_reason).toBe("Encerrado numa substituição que não terminou (o CT-2 não chegou a valer)");
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({
      action: "contract.close",
      details: {
        number: 1,
        reason: "Encerrado numa substituição que não terminou (o CT-2 não chegou a valer)",
        changes: { status: { from: "vigente", to: "encerrado" } },
      },
    });
    expect(h.logs[0].details).not.toHaveProperty("replacedBy");
  });

  it("reabertura impossível e trilha fora do ar: a mensagem avisa das duas coisas", async () => {
    semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.recorded = false;
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") return { message: "queda de rede" };
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toContain("ATENÇÃO");
    expect(r.error).toContain("trilha de auditoria");
  });

  it("ativação falha mas a reabertura funciona: sem rastro, sem motivo, sem trilha", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    let falhou = false;
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente" && !falhou) {
        falhou = true;
        return { message: "queda de rede" };
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toBeTruthy();
    expect(r.error).not.toContain("ATENÇÃO");
    expect(vig).toMatchObject({ status: "vigente", closed_at: null, closed_reason: null });
    expect(h.logs).toEqual([]);
  });

  it("trocar o motivo provisório pelo definitivo falhou: a troca vale e a tela recebe aviso", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.closed_reason === "Substituído pelo CT-2") return { message: "queda de rede" };
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(r.warning).toContain(PROVISORIO);
    expect(rasc.status).toBe("vigente");
    expect(vig.closed_reason).toBe(PROVISORIO);
    expect(h.logs.map((l) => l.action)).toEqual(["contract.activate", "contract.close"]);
  });

  it("nunca sobrescreve um motivo que não é o marcador desta troca", async () => {
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.status === "vigente") {
        h.beforeWrite = null;
        vig.closed_reason = "Motivo escrito por uma pessoa";
      }
    };
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(r.warning).toBeTruthy();
    expect(vig.closed_reason).toBe("Motivo escrito por uma pessoa");
  });

  it("criar já vigente substituindo repassa o aviso do motivo", async () => {
    const vig = semear({ status: "vigente", club_id: CLUB_A });
    h.beforeWrite = (op, _t, patch) => {
      if (op === "update" && patch.closed_reason === "Substituído pelo CT-2") return { message: "queda de rede" };
    };
    const r = await createContract(novo({ status: "vigente", replace: "true" }));
    expect(r.success).toBe(true);
    expect(r.warning).toContain(PROVISORIO);
    expect(porNumero(2).status).toBe("vigente");
    expect(vig.closed_reason).toBe(PROVISORIO);
  });

  it("ativar sem vigente anterior não toca em motivo nenhum", async () => {
    const rasc = semear({ status: "rascunho" });
    h.dbCalls.length = 0;
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.success).toBe(true);
    expect(h.dbCalls.filter((x) => x === "update:club_contracts")).toHaveLength(1);
  });
});

describe("updateContract", () => {
  const editar = (c: Linha, over: Record<string, string> = {}) =>
    updateContract(form({ contractId: idDe(c), ...campos, ...over }));

  it("rascunho e vigente aceitam edição; a trilha leva só o que mudou", async () => {
    for (const status of ["rascunho", "vigente"]) {
      linhas().length = 0;
      h.logs.length = 0;
      const c = semear({ status });
      const r = await editar(c, { priceReais: "199,90", notes: "reajuste combinado" });
      expect(r.success, status).toBe(true);
      expect(c.price_cents).toBe(19990);
      expect(c.notes).toBe("reajuste combinado");
      expect(h.logs).toHaveLength(1);
      expect(h.logs[0].action).toBe("contract.update");
      expect(Object.keys((h.logs[0].details as { changes: object }).changes).sort()).toEqual(["notes", "price_cents"]);
      expect((h.logs[0].details as { changes: Record<string, unknown> }).changes.price_cents).toEqual({ from: 14990, to: 19990 });
    }
  });

  it("encerrado e cancelado são somente leitura: nada muda, nada é registrado", async () => {
    for (const status of ["encerrado", "cancelado"]) {
      linhas().length = 0;
      const c = semear({ status, club_id: CLUB_B });
      const antes = { ...c };
      const r = await editar(c, { priceReais: "1,00", planName: "Hackeado" });
      expect(r.error, status).toContain("somente leitura");
      expect(c).toEqual(antes);
    }
    expect(h.logs).toEqual([]);
  });

  it("salvar sem mudar nada não é mudança: sem gravar, sem trilha", async () => {
    const c = semear({ status: "rascunho" });
    h.dbCalls.length = 0;
    const r = await editar(c);
    expect(r.success).toBe(true);
    expect(r.warning).toBeUndefined();
    expect(h.logs).toEqual([]);
    expect(h.dbCalls.filter((x) => x.startsWith("update"))).toEqual([]);
  });

  it("clube e situação não são editáveis nem se vierem no formulário", async () => {
    const c = semear({ status: "rascunho" });
    await editar(c, { clubId: CLUB_B, status: "vigente", club_id: CLUB_B, planName: "Outro nome" });
    expect(c.club_id).toBe(CLUB_A);
    expect(c.status).toBe("rascunho");
    expect(c.plan_name).toBe("Outro nome");
  });

  it("não deixa gravar fim anterior ao início", async () => {
    const c = semear({ status: "rascunho" });
    const r = await editar(c, { startsOn: "2026-10-10", endsOn: "2026-10-09" });
    expect(r.error).toContain("anterior");
    expect(c.starts_on).toBe("2026-10-01");
  });

  it("a situação mudou entre a leitura e a gravação: recusa em vez de editar histórico", async () => {
    const c = semear({ status: "vigente" });
    h.beforeWrite = (op) => {
      if (op === "update") {
        h.beforeWrite = null;
        c.status = "encerrado";
      }
    };
    const r = await editar(c, { planName: "Tarde demais" });
    expect(r.error).toContain("mudou de situação");
    expect(c.plan_name).toBe("Plano Clube");
  });

  it("contrato inexistente", async () => {
    const r = await updateContract(form({ contractId: "c0ffee00-0000-4000-8000-0000000000ff", ...campos }));
    expect(r.error).toBe("Contrato não encontrado.");
  });
});

describe("closeContract e cancelContract", () => {
  it("encerra o vigente com motivo e data", async () => {
    const c = semear({ status: "vigente" });
    const r = await closeContract(form({ contractId: idDe(c), reason: "  Acordo terminou  " }));
    expect(r.success).toBe(true);
    expect(c).toMatchObject({ status: "encerrado", closed_reason: "Acordo terminou" });
    expect(typeof c.closed_at).toBe("string");
    expect(h.logs[0]).toMatchObject({
      action: "contract.close",
      details: { number: 1, reason: "Acordo terminou", changes: { status: { from: "vigente", to: "encerrado" } } },
    });
  });

  it("encerrar e cancelar: o motivo inteiro fica no contrato, só o começo vai para a trilha imutável", async () => {
    const longo = `Cancelado a pedido de Maria Souza, telefone 11 90000-0000. ${"x".repeat(300)}`;
    const a = semear({ status: "vigente", club_id: CLUB_A });
    const b = semear({ status: "rascunho", club_id: CLUB_B });
    await closeContract(form({ contractId: idDe(a), reason: longo }));
    await cancelContract(form({ contractId: idDe(b), reason: longo }));
    expect(a.closed_reason).toBe(longo);
    expect(b.closed_reason).toBe(longo);
    expect(h.logs).toHaveLength(2);
    for (const log of h.logs) {
      const reason = (log.details as { reason: string }).reason;
      expect(reason).toBe(`${longo.slice(0, 120)}…`);
      expect(reason.length).toBe(121);
    }
  });

  it("motivo curto vai inteiro para a trilha", async () => {
    const c = semear({ status: "vigente" });
    await closeContract(form({ contractId: idDe(c), reason: "Acordo terminou" }));
    expect((h.logs[0].details as { reason: string }).reason).toBe("Acordo terminou");
  });

  it("motivo é obrigatório para encerrar e para cancelar", async () => {
    const c = semear({ status: "vigente" });
    for (const reason of ["", "  ", "ab"]) {
      expect((await closeContract(form({ contractId: idDe(c), reason }))).error, reason).toContain("motivo");
      expect((await cancelContract(form({ contractId: idDe(c), reason }))).error, reason).toContain("motivo");
    }
    expect((await closeContract(form({ contractId: idDe(c) }))).error).toContain("motivo");
    expect(c.status).toBe("vigente");
    expect(h.logs).toEqual([]);
  });

  it("só o vigente encerra", async () => {
    for (const status of ["rascunho", "encerrado", "cancelado"]) {
      linhas().length = 0;
      const c = semear({ status });
      const r = await closeContract(form({ contractId: idDe(c), reason: "motivo válido" }));
      expect(r.error, status).toContain("Só contrato vigente");
      expect(c.status).toBe(status);
    }
  });

  it("cancela rascunho ou vigente; encerrado e cancelado não", async () => {
    for (const status of ["rascunho", "vigente"]) {
      linhas().length = 0;
      const c = semear({ status });
      const r = await cancelContract(form({ contractId: idDe(c), reason: "cliente desistiu" }));
      expect(r.success, status).toBe(true);
      expect(c).toMatchObject({ status: "cancelado", closed_reason: "cliente desistiu" });
    }
    for (const status of ["encerrado", "cancelado"]) {
      linhas().length = 0;
      const c = semear({ status });
      const r = await cancelContract(form({ contractId: idDe(c), reason: "cliente desistiu" }));
      expect(r.error, status).toContain("Só rascunho ou contrato vigente");
      expect(c.status).toBe(status);
    }
  });

  it("a trilha distingue encerrar de cancelar", async () => {
    const a = semear({ status: "vigente", club_id: CLUB_A });
    const b = semear({ status: "rascunho", club_id: CLUB_B });
    await closeContract(form({ contractId: idDe(a), reason: "terminou" }));
    await cancelContract(form({ contractId: idDe(b), reason: "desistiu" }));
    expect(h.logs.map((l) => l.action)).toEqual(["contract.close", "contract.cancel"]);
  });

  it("depois de encerrado o clube pode ter outro vigente (índice só pega vigente)", async () => {
    const a = semear({ status: "vigente" });
    await closeContract(form({ contractId: idDe(a), reason: "terminou" }));
    const r = await createContract(novo({ status: "vigente" }));
    expect(r.success).toBe(true);
  });
});

describe("renewContract", () => {
  it("cria o rascunho do próximo período: começa no dia seguinte e mantém ciclo, plano e preço", async () => {
    const c = semear({ status: "vigente", billing_cycle: "anual", price_cents: 120000, starts_on: "2026-01-01", ends_on: "2026-12-31", plan_name: "Anual", max_athletes: 80 });
    const r = await renewContract(form({ contractId: idDe(c) }));
    expect(r.success).toBe(true);
    expect(r.contractId).toBeTruthy();
    const novoContrato = porNumero(2);
    expect(novoContrato).toMatchObject({
      status: "rascunho",
      club_id: CLUB_A,
      billing_cycle: "anual",
      price_cents: 120000,
      plan_name: "Anual",
      max_athletes: 80,
      starts_on: "2027-01-01",
      ends_on: "2027-12-31",
      document_path: null,
      signed_on: null,
      signer_name: null,
    });
    // O contrato de origem continua vigente: a renovação só vale quando alguém a ativar.
    expect(c.status).toBe("vigente");
    expect(h.logs[0]).toMatchObject({ action: "contract.renew", details: { number: 2, renewedFrom: 1 } });
  });

  it("encerrado também pode ser renovado", async () => {
    const c = semear({ status: "encerrado" });
    expect((await renewContract(form({ contractId: idDe(c) }))).success).toBe(true);
  });

  it("rascunho, cancelado e prazo indeterminado não renovam", async () => {
    const rasc = semear({ status: "rascunho" });
    expect((await renewContract(form({ contractId: idDe(rasc) }))).error).toContain("Só contrato vigente ou encerrado");
    const canc = semear({ status: "cancelado", club_id: CLUB_B });
    expect((await renewContract(form({ contractId: idDe(canc) }))).error).toContain("Só contrato vigente ou encerrado");
    const sem = semear({ status: "encerrado", ends_on: null, club_id: CLUB_B });
    expect((await renewContract(form({ contractId: idDe(sem) }))).error).toContain("indeterminado");
    expect(linhas()).toHaveLength(3);
  });

  it("renovar duas vezes o mesmo contrato não cria dois rascunhos para o mesmo período", async () => {
    const c = semear({ status: "vigente" });
    expect((await renewContract(form({ contractId: idDe(c) }))).success).toBe(true);
    const segunda = await renewContract(form({ contractId: idDe(c) }));
    expect(segunda.error).toContain("Já existe o CT-2");
    expect(segunda.error).toContain("01/11/2026");
    expect(linhas()).toHaveLength(2);
  });
});

describe("requestContractDocumentUpload", () => {
  it("monta o caminho no servidor: {club}/{contrato}/{uuid}.pdf", async () => {
    const c = semear({ status: "rascunho" });
    const r = await requestContractDocumentUpload(idDe(c));
    expect(r.success).toBe(true);
    expect(r.upload?.path).toMatch(new RegExp(`^${CLUB_A}/${idDe(c)}/[0-9a-f-]{36}\\.pdf$`));
    expect(r.upload?.token).toBe("tok-1");
    expect(r.upload?.maxBytes).toBe(MAX_DOCUMENT_BYTES);
    expect(h.tickets).toEqual([r.upload?.path]);
  });

  it("cada pedido ganha um nome novo (nunca o nome que a pessoa deu)", async () => {
    const c = semear({ status: "vigente" });
    const a = await requestContractDocumentUpload(idDe(c));
    const b = await requestContractDocumentUpload(idDe(c));
    expect(a.upload?.path).not.toBe(b.upload?.path);
  });

  it("encerrado e cancelado não recebem documento", async () => {
    for (const status of ["encerrado", "cancelado"]) {
      const c = semear({ status, club_id: CLUB_B });
      const r = await requestContractDocumentUpload(idDe(c));
      expect(r.error, status).toContain("somente leitura");
    }
    expect(h.tickets).toEqual([]);
  });

  it("id malformado ou inexistente", async () => {
    expect((await requestContractDocumentUpload("../../etc/passwd")).error).toBe("Contrato inválido.");
    expect((await requestContractDocumentUpload("c0ffee00-0000-4000-8000-0000000000ff")).error).toBe("Contrato não encontrado.");
    expect(h.tickets).toEqual([]);
  });

  it("bucket ausente: mensagem clara, sem estourar", async () => {
    const c = semear({ status: "rascunho" });
    h.bucketMissing = true;
    const r = await requestContractDocumentUpload(idDe(c));
    expect(r.error).toContain("club-contracts");
    expect(r.error).toContain("0073");
  });
});

describe("confirmContractDocument", () => {
  const caminho = (c: Linha, arquivo = "11111111-2222-4333-8444-555555555555") => `${c.club_id}/${c.id}/${arquivo}.pdf`;
  const guardar = (path: string, over: Partial<{ size: number; contentType: string }> = {}) =>
    h.objects.set(path, { size: 2048, contentType: "application/pdf", ...over });

  it("confere no storage e só então grava document_path; registra a trilha com o tamanho", async () => {
    const c = semear({ status: "vigente" });
    const path = caminho(c);
    guardar(path);
    const r = await confirmContractDocument(idDe(c), path);
    expect(r.success).toBe(true);
    expect(c.document_path).toBe(path);
    expect(h.logs[0]).toMatchObject({
      action: "contract.document_attach",
      details: { number: 1, replaced: false, sizeBytes: 2048 },
    });
    expect(h.removed).toEqual([]);
  });

  it("document_path SEMPRE começa com {club}/{contrato}/: caminho de outro contrato ou clube é recusado", async () => {
    const c = semear({ status: "vigente", club_id: CLUB_A });
    const outro = semear({ status: "vigente", club_id: CLUB_B });
    const alheio = caminho(outro);
    guardar(alheio);
    const r = await confirmContractDocument(idDe(c), alheio);
    expect(r.error).toBe("Arquivo inválido. Envie o PDF de novo.");
    expect(c.document_path).toBeNull();
    expect(outro.document_path).toBeNull();
    // E o arquivo alheio NÃO é apagado por engano.
    expect(h.removed).toEqual([]);
    expect(h.objects.has(alheio)).toBe(true);
  });

  it("recusa travessia de diretório, subpasta e nome que não é uuid.pdf", async () => {
    const c = semear({ status: "vigente" });
    const outro = semear({ status: "vigente", club_id: CLUB_B });
    for (const ruim of [
      `${c.club_id}/${c.id}/../${outro.id}/11111111-2222-4333-8444-555555555555.pdf`,
      `${c.club_id}/${c.id}/sub/11111111-2222-4333-8444-555555555555.pdf`,
      `${c.club_id}/${c.id}/contrato.pdf`,
      `${c.club_id}/${c.id}/`,
      `${outro.club_id}/${outro.id}/11111111-2222-4333-8444-555555555555.pdf`,
      "qualquer/coisa.pdf",
    ]) {
      guardar(ruim);
      const r = await confirmContractDocument(idDe(c), ruim);
      expect(r.error, ruim).toBe("Arquivo inválido. Envie o PDF de novo.");
    }
    expect(c.document_path).toBeNull();
  });

  it("arquivo que não chegou ao storage", async () => {
    const c = semear({ status: "vigente" });
    const r = await confirmContractDocument(idDe(c), caminho(c));
    expect(r.error).toContain("Não encontramos o arquivo");
    expect(c.document_path).toBeNull();
  });

  it("objeto que não é PDF é recusado E apagado do bucket", async () => {
    const c = semear({ status: "vigente" });
    const path = caminho(c);
    guardar(path, { contentType: "text/html" });
    const r = await confirmContractDocument(idDe(c), path);
    expect(r.error).toBe("O arquivo enviado não é um PDF.");
    expect(c.document_path).toBeNull();
    expect(h.removed).toEqual([path]);
  });

  it("acima de 10 MB é recusado e apagado; exatamente 10 MB passa", async () => {
    const c = semear({ status: "vigente" });
    const grande = caminho(c, "aaaaaaaa-2222-4333-8444-555555555555");
    guardar(grande, { size: MAX_DOCUMENT_BYTES + 1 });
    const r = await confirmContractDocument(idDe(c), grande);
    expect(r.error).toContain("limite");
    expect(h.removed).toEqual([grande]);

    const justo = caminho(c, "bbbbbbbb-2222-4333-8444-555555555555");
    guardar(justo, { size: MAX_DOCUMENT_BYTES });
    expect((await confirmContractDocument(idDe(c), justo)).success).toBe(true);
    expect(c.document_path).toBe(justo);
  });

  it("arquivo vazio é recusado", async () => {
    const c = semear({ status: "vigente" });
    const path = caminho(c);
    guardar(path, { size: 0 });
    expect((await confirmContractDocument(idDe(c), path)).error).toContain("vazio");
  });

  it("substituir apaga o arquivo anterior do mesmo contrato", async () => {
    const antigo = (c: Linha) => caminho(c, "99999999-2222-4333-8444-555555555555");
    const c = semear({ status: "vigente" });
    c.document_path = antigo(c);
    guardar(antigo(c));
    const novoPath = caminho(c);
    guardar(novoPath);
    const r = await confirmContractDocument(idDe(c), novoPath);
    expect(r.success).toBe(true);
    expect(c.document_path).toBe(novoPath);
    expect(h.removed).toEqual([antigo(c)]);
    expect(h.logs[0].details).toMatchObject({ replaced: true });
  });

  it("document_path antigo adulterado (aponta para outro clube) NÃO é apagado", async () => {
    const c = semear({ status: "vigente" });
    const alheio = `${CLUB_B}/qualquer-contrato/segredo.pdf`;
    c.document_path = alheio;
    guardar(alheio);
    const novoPath = caminho(c);
    guardar(novoPath);
    const r = await confirmContractDocument(idDe(c), novoPath);
    expect(r.success).toBe(true);
    expect(h.removed).not.toContain(alheio);
    expect(h.objects.has(alheio)).toBe(true);
  });

  it("se o arquivo anterior não pôde ser apagado, o novo vale e a tela é avisada", async () => {
    const c = semear({ status: "vigente" });
    c.document_path = caminho(c, "99999999-2222-4333-8444-555555555555");
    guardar(String(c.document_path));
    guardar(caminho(c));
    h.removeFails = true;
    const r = await confirmContractDocument(idDe(c), caminho(c));
    expect(r.success).toBe(true);
    expect(r.warning).toContain("não pôde ser apagado");
    expect(c.document_path).toBe(caminho(c));
  });

  it("falha ao gravar no banco: o arquivo recém-enviado não fica órfão", async () => {
    const c = semear({ status: "vigente" });
    const path = caminho(c);
    guardar(path);
    h.beforeWrite = (op) => (op === "update" ? { message: "queda de rede" } : undefined);
    const r = await confirmContractDocument(idDe(c), path);
    expect(r.error).toBeTruthy();
    expect(c.document_path).toBeNull();
    expect(h.removed).toEqual([path]);
  });

  it("encerrado e cancelado não recebem documento", async () => {
    for (const status of ["encerrado", "cancelado"]) {
      linhas().length = 0;
      const c = semear({ status });
      guardar(caminho(c));
      const r = await confirmContractDocument(idDe(c), caminho(c));
      expect(r.error, status).toContain("somente leitura");
      expect(c.document_path).toBeNull();
    }
  });

  it("bucket ausente na conferência", async () => {
    const c = semear({ status: "vigente" });
    h.bucketMissing = true;
    const r = await confirmContractDocument(idDe(c), caminho(c));
    expect(r.error).toContain("club-contracts");
  });
});

describe("removeContractDocument", () => {
  it("desvincula e apaga o arquivo; registra a trilha", async () => {
    const c = semear({ status: "vigente" });
    const path = `${c.club_id}/${c.id}/11111111-2222-4333-8444-555555555555.pdf`;
    c.document_path = path;
    h.objects.set(path, { size: 10, contentType: "application/pdf" });
    const r = await removeContractDocument(idDe(c));
    expect(r.success).toBe(true);
    expect(c.document_path).toBeNull();
    expect(h.removed).toEqual([path]);
    expect(h.logs[0]).toMatchObject({ action: "contract.document_remove", details: { number: 1 } });
  });

  it("sem documento anexado", async () => {
    const c = semear({ status: "vigente" });
    expect((await removeContractDocument(idDe(c))).error).toBe("Este contrato não tem documento anexado.");
  });

  it("encerrado não perde o documento", async () => {
    const c = semear({ status: "encerrado", document_path: "x" });
    expect((await removeContractDocument(idDe(c))).error).toContain("somente leitura");
    expect(c.document_path).toBe("x");
  });

  it("caminho adulterado: desvincula, mas não apaga arquivo fora da pasta do contrato, e avisa", async () => {
    const c = semear({ status: "vigente" });
    const alheio = `${CLUB_B}/outro/segredo.pdf`;
    c.document_path = alheio;
    h.objects.set(alheio, { size: 10, contentType: "application/pdf" });
    const r = await removeContractDocument(idDe(c));
    expect(r.success).toBe(true);
    expect(r.warning).toContain("não pôde ser apagado");
    expect(h.removed).toEqual([]);
    expect(h.objects.has(alheio)).toBe(true);
  });
});

describe("getContractDocumentUrl", () => {
  it("devolve link assinado de 60 segundos, com nome de download", async () => {
    const c = semear({ status: "encerrado" });
    c.document_path = `${c.club_id}/${c.id}/11111111-2222-4333-8444-555555555555.pdf`;
    const r = await getContractDocumentUrl(idDe(c));
    expect(r.url).toContain(String(c.document_path));
    expect(r.error).toBeUndefined();
    expect(h.signed).toEqual([{ path: c.document_path, ttl: 60, options: { download: "contrato-CT-1.pdf" } }]);
  });

  it("encerrado ainda baixa (é leitura, não edição)", async () => {
    const c = semear({ status: "cancelado" });
    c.document_path = `${c.club_id}/${c.id}/a.pdf`;
    expect((await getContractDocumentUrl(idDe(c))).url).toBeTruthy();
  });

  it("document_path fora da pasta do contrato nunca vira link", async () => {
    const c = semear({ status: "vigente" });
    for (const ruim of [`${CLUB_B}/x/y.pdf`, `${c.club_id}/${c.id}/../../${CLUB_B}/y.pdf`, "../segredo.pdf"]) {
      c.document_path = ruim;
      const r = await getContractDocumentUrl(idDe(c));
      expect(r.url, ruim).toBeUndefined();
      expect(r.error, ruim).toContain("inválido");
    }
    expect(h.signed).toEqual([]);
  });

  it("sem documento, contrato inexistente e id malformado", async () => {
    const c = semear({ status: "vigente" });
    expect((await getContractDocumentUrl(idDe(c))).error).toBe("Este contrato não tem documento anexado.");
    expect((await getContractDocumentUrl("c0ffee00-0000-4000-8000-0000000000ff")).error).toBe("Contrato não encontrado.");
    expect((await getContractDocumentUrl("lixo")).error).toBe("Contrato inválido.");
  });

  it("bucket ausente", async () => {
    const c = semear({ status: "vigente" });
    c.document_path = `${c.club_id}/${c.id}/a.pdf`;
    h.bucketMissing = true;
    expect((await getContractDocumentUrl(idDe(c))).error).toContain("club-contracts");
  });

  it("cada link emitido fica na trilha, com contrato e número, sem o caminho do arquivo", async () => {
    const c = semear({ status: "encerrado" });
    c.document_path = `${c.club_id}/${c.id}/11111111-2222-4333-8444-555555555555.pdf`;
    const r = await getContractDocumentUrl(idDe(c));
    expect(r.url).toBeTruthy();
    expect(r.warning).toBeUndefined();
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({
      action: "contract.document_download",
      club: { id: CLUB_A, name: "Clube A" },
      details: { contractId: c.id, number: 1 },
    });
    expect(JSON.stringify(h.logs[0].details)).not.toContain(".pdf");
    // Gerar o link não muda nada no contrato.
    expect(h.events).toEqual(["log:contract.document_download"]);
  });

  it("a trilha falhou: o link sai mesmo assim, com aviso", async () => {
    const c = semear({ status: "vigente" });
    c.document_path = `${c.club_id}/${c.id}/a.pdf`;
    h.recorded = false;
    const r = await getContractDocumentUrl(idDe(c));
    expect(r.url).toContain("a.pdf");
    expect(r.error).toBeUndefined();
    expect(r.warning).toContain("NÃO foi registrado");
  });

  it("onde nenhum link sai, nada é registrado", async () => {
    const c = semear({ status: "vigente" });
    await getContractDocumentUrl(idDe(c)); // sem documento
    c.document_path = `${CLUB_B}/x/y.pdf`;
    await getContractDocumentUrl(idDe(c)); // fora da pasta
    c.document_path = `${c.club_id}/${c.id}/a.pdf`;
    h.bucketMissing = true;
    await getContractDocumentUrl(idDe(c)); // bucket ausente
    await getContractDocumentUrl("lixo");
    expect(h.logs).toEqual([]);
  });
});


describe("activateContract pela função atômica (migração 0076)", () => {
  const escritasDiretas = () => h.events.filter((e) => e === "update:club_contracts" || e === "insert:club_contracts");

  it("sem vigente: ativa chamando a função, sem nenhuma escrita direta em club_contracts", async () => {
    h.rpcMode = "atomica";
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.success).toBe(true);
    expect(rasc.status).toBe("vigente");
    expect(h.rpcCalls).toEqual(["platform_activate_contract"]);
    expect(escritasDiretas()).toEqual([]);
    expect(h.logs.map((l) => l.action)).toEqual(["contract.activate"]);
  });

  it("existe vigente e não confirmou: pede confirmação, nada muda e nada vai para a trilha", async () => {
    h.rpcMode = "atomica";
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.success).toBeUndefined();
    expect(r.needsReplaceConfirmation).toEqual({ currentNumber: 1 });
    expect(r.error).toContain("CT-1");
    expect(vig.status).toBe("vigente");
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toEqual([]);
  });

  it("com confirmação: troca pela função e a trilha é a mesma do caminho sequencial", async () => {
    h.rpcMode = "atomica";
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(rasc.status).toBe("vigente");
    expect(vig).toMatchObject({ status: "encerrado", closed_reason: "Substituído pelo CT-2" });
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(1);
    expect(escritasDiretas()).toEqual([]);

    expect(h.logs.map((l) => l.action)).toEqual(["contract.activate", "contract.close"]);
    expect(h.logs[0].details).toMatchObject({ number: 2, replaces: 1 });
    expect(h.logs[1].details).toMatchObject({
      number: 1,
      replacedBy: 2,
      reason: "Substituído pelo CT-2",
      changes: { status: { from: "vigente", to: "encerrado" } },
    });
  });

  it("falha da função desfaz TUDO: o antigo segue vigente, o rascunho segue rascunho e NÃO cai no plano B", async () => {
    h.rpcMode = "atomica";
    h.rpcAtomicFail = true;
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBeUndefined();
    expect(r.error).toBeTruthy();
    expect(vig).toMatchObject({ status: "vigente", closed_at: null, closed_reason: null });
    expect(rasc.status).toBe("rascunho");
    expect(h.logs).toEqual([]);
    // Erro transitório não pode disparar o plano B: ele refaria a troca em duas gravações.
    expect(escritasDiretas()).toEqual([]);
    expect(h.rpcCalls).toHaveLength(1);
  });

  it("erro genérico do banco (timeout) também não cai no plano B", async () => {
    h.rpcMode = "erro";
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.error).toBeTruthy();
    expect(vig.status).toBe("vigente");
    expect(rasc.status).toBe("rascunho");
    expect(escritasDiretas()).toEqual([]);
  });

  it("contrato que já não é rascunho é recusado ANTES de chamar a função", async () => {
    h.rpcMode = "atomica";
    const jaVigente = semear({ status: "vigente" });
    const r = await activateContract(form({ contractId: idDe(jaVigente) }));
    expect(r.error).toContain("Só rascunho pode ser ativado");
    expect(h.rpcCalls).toEqual([]);
    expect(h.logs).toEqual([]);
  });

  it("corrida: o contrato muda de situação depois da checagem e a função devolve not_draft", async () => {
    h.rpcMode = "atomica";
    const rasc = semear({ status: "rascunho" });
    h.beforeRpc = () => {
      rasc.status = "cancelado"; // alguém cancelou entre a checagem e a chamada
    };
    const r = await activateContract(form({ contractId: idDe(rasc) }));
    expect(r.success).toBeUndefined();
    expect(r.error).toContain("mudou de situação");
    expect(rasc.status).toBe("cancelado");
    expect(h.logs).toEqual([]);
  });

  it("função inexistente (ambiente sem a 0076): usa o plano B sequencial e o resultado é o mesmo", async () => {
    h.rpcMode = "ausente";
    const vig = semear({ status: "vigente" });
    const rasc = semear({ status: "rascunho" });
    const r = await activateContract(form({ contractId: idDe(rasc), replace: "true" }));
    expect(r.success).toBe(true);
    expect(h.rpcCalls).toEqual(["platform_activate_contract"]);
    expect(escritasDiretas().length).toBeGreaterThan(0);
    expect(rasc.status).toBe("vigente");
    expect(vig).toMatchObject({ status: "encerrado", closed_reason: "Substituído pelo CT-2" });
    expect(h.logs.map((l) => l.action)).toEqual(["contract.activate", "contract.close"]);
  });

  it("criar já vigente com substituição também passa pela função", async () => {
    h.rpcMode = "atomica";
    const vig = semear({ status: "vigente" });
    const r = await createContract(novo({ status: "vigente", replace: "true" }));
    expect(r.success).toBe(true);
    expect(h.rpcCalls).toEqual(["platform_activate_contract"]);
    expect(vig.status).toBe("encerrado");
    expect(linhas().filter((l) => l.status === "vigente")).toHaveLength(1);
  });
});
