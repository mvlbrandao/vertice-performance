import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// As três páginas de contrato executadas de ponta a ponta no servidor, com a
// camada de dados trocada por dados em memória: prova a composição (indicadores,
// filtros por URL, listas vazias, migração pendente, 404) sem subir o Next.
// Não prova o desenho no navegador (CSS, quebra de linha em 360px): isso é
// trabalho do agente de navegador.

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  isAdmin: true,
  calls: [] as string[],
  contracts: { data: [] as unknown[], migrationPending: false },
  clubs: [] as unknown[],
  active: { data: new Map<string, unknown>(), migrationPending: false },
  found: { data: null as unknown, migrationPending: false },
  history: { data: [] as unknown[], migrationPending: false },
  trail: { data: [] as unknown[], migrationPending: false },
  auditAvailable: true,
  settings: { planName: "Vértice Clube", priceCents: 14990, trialDays: 14, maxAthletes: 50, retentionDays: 90 },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/lib/platform/admin", () => ({
  requirePlatformAdmin: async () => {
    h.calls.push("admin");
    if (!h.isAdmin) throw new Error("NEXT_NOT_FOUND");
    return { userId: "u", email: "dono@exemplo.com", fullName: "Dono" };
  },
}));
vi.mock("@/lib/platform/contracts", () => ({
  listAllContracts: async () => (h.calls.push("listAllContracts"), h.contracts),
  listClubsForContracts: async () => (h.calls.push("listClubsForContracts"), h.clubs),
  getActiveContractsByClub: async () => (h.calls.push("getActiveContractsByClub"), h.active),
  getContractWithClub: async () => (h.calls.push("getContractWithClub"), h.found),
  listClubContracts: async () => (h.calls.push("listClubContracts"), h.history),
  listContractAuditTrail: async () => (h.calls.push("listContractAuditTrail"), h.trail),
}));
vi.mock("@/lib/platform/license", () => ({
  getPlatformSettings: async () => h.settings,
}));
vi.mock("@/lib/platform/audit", () => ({
  isAuditTrailAvailable: async () => h.auditAvailable,
}));
vi.mock("@/lib/actions/contracts", () => ({
  createContract: async () => ({}),
  updateContract: async () => ({}),
  activateContract: async () => ({}),
  closeContract: async () => ({}),
  cancelContract: async () => ({}),
  renewContract: async () => ({}),
  requestContractDocumentUpload: async () => ({}),
  confirmContractDocument: async () => ({}),
  removeContractDocument: async () => ({}),
  getContractDocumentUrl: async () => ({}),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import AdminContratosPage from "@/app/(admin)/admin/contratos/page";
import AdminNovoContratoPage from "@/app/(admin)/admin/contratos/novo/page";
import AdminContratoPage from "@/app/(admin)/admin/contratos/[contractId]/page";

const CLUBE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CLUBE_B = "aaaaaaaa-0000-4000-8000-000000000002";
const CLUBE_C = "aaaaaaaa-0000-4000-8000-000000000003";

function clube(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    status: "ativo",
    trial_ends_at: null,
    courtesy_until: null,
    max_athletes_override: null,
    price_cents_override: null,
    is_demo: false,
    ...over,
  };
}

function contrato(n: number, clubId: string, over: Record<string, unknown> = {}) {
  return {
    id: `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`,
    number: n,
    club_id: clubId,
    status: "vigente",
    plan_name: "Plano Clube",
    price_cents: 14990,
    max_athletes: null,
    billing_cycle: "mensal",
    starts_on: "2026-10-01",
    ends_on: "2027-09-30",
    auto_renew: true,
    signed_on: null,
    signer_name: null,
    signer_role: null,
    terms_version: null,
    document_path: "x/y/z.pdf",
    notes: null,
    closed_at: null,
    closed_reason: null,
    created_by_email: "dono@exemplo.com",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const search = (obj: Record<string, string> = {}) => Promise.resolve(obj);
const render = async (page: Promise<Parameters<typeof renderToStaticMarkup>[0]>) => renderToStaticMarkup(await page);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T15:00:00Z"));
  h.isAdmin = true;
  h.calls.length = 0;
  h.contracts = { data: [], migrationPending: false };
  h.clubs = [];
  h.active = { data: new Map(), migrationPending: false };
  h.found = { data: null, migrationPending: false };
  h.history = { data: [], migrationPending: false };
  h.trail = { data: [], migrationPending: false };
  h.auditAvailable = true;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("/admin/contratos (lista)", () => {
  it("chama requirePlatformAdmin antes de qualquer leitura", async () => {
    await render(AdminContratosPage({ searchParams: search() }));
    expect(h.calls[0]).toBe("admin");
  });

  it("quem não é administrador não lê nada", async () => {
    h.isAdmin = false;
    await expect(AdminContratosPage({ searchParams: search() })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.calls).toEqual(["admin"]);
  });

  it("migração 0073 pendente: aviso, nenhuma leitura de clubes, e o botão de novo contrato continua", async () => {
    h.contracts = { data: [], migrationPending: true };
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).toContain("Migração 0073 pendente");
    expect(out).toContain('href="/admin/contratos/novo"');
    expect(out).not.toContain("Indicadores");
    expect(h.calls).not.toContain("listClubsForContracts");
  });

  it("sem contratos: estado vazio que ensina o próximo passo", async () => {
    h.clubs = [clube(CLUBE_A, "Clube da Praia", { is_demo: true })];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).toContain("Nenhum contrato ainda");
    expect(out).toContain("Novo contrato");
  });

  it("indicadores: vigentes, receita mensal equivalente, vencem em 30 dias, sem documento e rascunhos", async () => {
    h.clubs = [clube(CLUBE_A, "Praia"), clube(CLUBE_B, "Costa"), clube(CLUBE_C, "Sul")];
    h.contracts.data = [
      contrato(1, CLUBE_A, { ends_on: "2026-10-20" }),
      contrato(2, CLUBE_B, { billing_cycle: "anual", price_cents: 120000, document_path: null }),
      contrato(3, CLUBE_C, { status: "rascunho", document_path: null }),
      contrato(4, CLUBE_C, { status: "encerrado" }),
    ];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    const kpi = (rotulo: string) => {
      const m = new RegExp(`${rotulo}</span><b[^>]*>([^<]*)</b>`).exec(out);
      return m?.[1];
    };
    expect(kpi("Contratos vigentes")).toBe("2");
    // 149,90 + 1.200,00/12 = 249,90
    expect(kpi("Receita mensal")).toContain("249,90");
    expect(kpi("Vencem em 30 dias")).toBe("1");
    expect(kpi("Sem documento")).toBe("1");
    expect(kpi("Rascunhos")).toBe("1");
    expect(out).toContain("4 contratos");
  });

  it("os indicadores levam ao filtro correspondente", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    for (const href of [
      "/admin/contratos?status=vigente",
      "/admin/contratos?vencimento=30",
      "/admin/contratos?status=vigente&amp;documento=sem",
      "/admin/contratos?status=rascunho",
    ]) {
      expect(out).toContain(`href="${href}"`);
    }
  });

  it("filtros da URL: só rascunhos, e diz 'N de M'", async () => {
    h.clubs = [clube(CLUBE_A, "Praia"), clube(CLUBE_B, "Costa")];
    h.contracts.data = [contrato(1, CLUBE_A), contrato(2, CLUBE_B, { status: "rascunho" })];
    const out = await render(AdminContratosPage({ searchParams: search({ status: "rascunho" }) }));
    expect(out).toContain("1 de 2 contratos");
    expect(out).toContain("CT-2");
    expect(out).not.toContain(">CT-1<");
  });

  it("filtro sem resultado", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const out = await render(AdminContratosPage({ searchParams: search({ q: "inexistente" }) }));
    expect(out).toContain("Nenhum contrato com esses filtros");
  });

  it("parâmetro de URL inválido é ignorado, não vira erro", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const out = await render(AdminContratosPage({ searchParams: search({ status: "'; drop table", vencimento: "99" }) }));
    expect(out).toContain("CT-1");
  });

  it("clube pagante sem contrato vigente aparece como atalho para criar", async () => {
    h.clubs = [clube(CLUBE_A, "Praia"), clube(CLUBE_B, "Costa Azul", { status: "atrasado" })];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).toContain("1 clube pagante sem contrato vigente");
    expect(out).toContain(`href="/admin/contratos/novo?clubId=${CLUBE_B}"`);
    expect(out).toContain("em atraso");
  });

  it("vigente vencido: faixa de alerta com atalho para os vencidos", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = [contrato(1, CLUBE_A, { ends_on: "2026-10-01" })];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).toContain("contrato vigente está vencido");
    expect(out).toContain('href="/admin/contratos?vencimento=vencidos"');
  });

  it("divergência com a licença aparece no cartão", async () => {
    h.clubs = [clube(CLUBE_A, "Praia", { status: "bloqueado" })];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).toContain("diverge da licença");
    expect(out).toContain("bloqueado");
  });

  it("muitos contratos: desenha 200 e diz que há mais", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = Array.from({ length: 250 }, (_, i) => contrato(i + 1, CLUBE_A, { status: "encerrado" }));
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out.match(/<article/g)).toHaveLength(200);
    expect(out).toContain("Mostrando 200 de 250 contratos");
  });

  it("não coloca dado sensível na página: e-mail de quem criou, nota interna, nome do signatário", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.contracts.data = [contrato(1, CLUBE_A, { notes: "segredo de negociação", signer_name: "Maria Silva" })];
    const out = await render(AdminContratosPage({ searchParams: search() }));
    expect(out).not.toContain("segredo de negociação");
    expect(out).not.toContain("Maria Silva");
    expect(out).not.toContain("dono@exemplo.com");
  });

  it("erro de leitura sobe para o error boundary (a página não esconde a falha)", async () => {
    h.clubs = [];
    h.contracts.data = [contrato(1, CLUBE_A)];
    const quebrada = vi.fn(() => {
      throw new Error("Falha ao ler os clubes");
    });
    h.settings = new Proxy(h.settings, {
      get() {
        return quebrada();
      },
    });
    await expect(AdminContratosPage({ searchParams: search() })).rejects.toThrow("Falha ao ler os clubes");
    h.settings = { planName: "Vértice Clube", priceCents: 14990, trialDays: 14, maxAthletes: 50, retentionDays: 90 };
  });
});

describe("/admin/contratos/novo", () => {
  it("chama requirePlatformAdmin primeiro e barra estranhos", async () => {
    h.isAdmin = false;
    await expect(AdminNovoContratoPage({ searchParams: search() })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.calls).toEqual(["admin"]);
  });

  it("formulário completo com plano e cota padrão das configurações", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Novo contrato");
    expect(out).toContain('value="Vértice Clube"');
    expect(out).toContain('value="149,90"');
    expect(out).toContain("padrão: 50");
    expect(out).toContain('value="2026-10-08"');
  });

  it("?clubId= pré-seleciona; id desconhecido ou malformado é ignorado", async () => {
    h.clubs = [clube(CLUBE_A, "Praia"), clube(CLUBE_B, "Costa")];
    const ok = await render(AdminNovoContratoPage({ searchParams: search({ clubId: CLUBE_B }) }));
    expect(ok).toMatch(new RegExp(`<option value="${CLUBE_B}" selected`));

    for (const clubId of ["eeeeeeee-0000-4000-8000-000000000009", "lixo", "' OR 1=1"]) {
      const out = await render(AdminNovoContratoPage({ searchParams: search({ clubId }) }));
      expect(out).not.toMatch(/<option value="[0-9a-f-]{36}" selected/);
    }
  });

  it("clube que já tem vigente é sinalizado na lista", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.active.data = new Map([[CLUBE_A, { number: 3 }]]);
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Praia (tem CT-3 vigente)");
  });

  it("clube de demonstração é identificado", async () => {
    h.clubs = [clube(CLUBE_A, "Vértice Demo", { is_demo: true })];
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Vértice Demo (demonstração)");
  });

  it("migração 0073 pendente: aviso no lugar do formulário", async () => {
    h.active = { data: new Map(), migrationPending: true };
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Migração 0073 pendente");
    expect(out).not.toContain("Criar contrato");
  });

  it("trilha de auditoria ausente (0072): avisa que a criação não será registrada, e o formulário segue", async () => {
    h.clubs = [clube(CLUBE_A, "Praia")];
    h.auditAvailable = false;
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Migração 0072 pendente");
    expect(out).toContain("Criar contrato");
  });

  it("sem nenhum clube: estado vazio", async () => {
    const out = await render(AdminNovoContratoPage({ searchParams: search() }));
    expect(out).toContain("Nenhum clube cadastrado");
    expect(out).not.toContain("Criar contrato");
  });
});

describe("/admin/contratos/[contractId]", () => {
  const ID = "cccccccc-0000-4000-8000-000000000007";
  const params = (contractId: string) => Promise.resolve({ contractId });

  function achar(over: Record<string, unknown> = {}, clubeOver: Record<string, unknown> | null = {}) {
    const c = contrato(7, CLUBE_A, over);
    h.found = { data: { contract: c, club: clubeOver === null ? null : clube(CLUBE_A, "Clube da Praia", clubeOver) }, migrationPending: false };
    h.history = { data: [c], migrationPending: false };
    return c;
  }

  it("chama requirePlatformAdmin primeiro e barra estranhos", async () => {
    h.isAdmin = false;
    await expect(AdminContratoPage({ params: params(ID) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.calls).toEqual(["admin"]);
  });

  it("id malformado => notFound, sem consultar o banco", async () => {
    for (const id of ["123", "../../etc/passwd", "novo", "ZZZZZZZZ-0000-4000-8000-000000000007"]) {
      await expect(AdminContratoPage({ params: params(id) })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(h.calls.filter((c) => c !== "admin")).toEqual([]);
  });

  it("id inexistente => notFound", async () => {
    h.found = { data: null, migrationPending: false };
    await expect(AdminContratoPage({ params: params(ID) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("migração 0073 pendente: aviso, não 404 nem erro", async () => {
    h.found = { data: null, migrationPending: true };
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("Migração 0073 pendente");
  });

  it("vigente: dados editáveis, ações, licença, documento e trilha", async () => {
    achar();
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("CT-7");
    expect(out).toContain("Clube da Praia");
    expect(out).toContain("Dados do contrato");
    expect(out).toContain('name="planName"');
    expect(out).toContain("Salvar alterações");
    expect(out).toContain("Contrato x Licença atual");
    expect(out).toContain("Contrato e licença estão de acordo");
    expect(out).toContain("Documento assinado");
    expect(out).toContain("Baixar");
    expect(out).toContain("Encerrar");
    expect(out).toContain("Renovar");
    expect(out).toContain("Trilha de auditoria");
    expect(out).toContain("Nenhum registro com esses filtros");
  });

  it("divergências aparecem explicadas e no cabeçalho", async () => {
    achar({ price_cents: 9900 }, { status: "bloqueado" });
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("diverge da licença");
    expect(out).toContain("O contrato vale R$");
    expect(out).toContain("o clube está bloqueado");
  });

  it("encerrado: somente leitura, sem formulário, com o motivo, e ainda baixa o documento", async () => {
    achar({ status: "encerrado", closed_at: "2026-10-05T15:00:00Z", closed_reason: "Substituído pelo CT-8" });
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("somente leitura");
    expect(out).not.toContain('name="planName"');
    expect(out).not.toContain("Salvar alterações");
    expect(out).toContain("Substituído pelo CT-8");
    expect(out).toContain("Baixar");
    expect(out).not.toContain("Substituir PDF");
    expect(out).not.toContain("Contrato e licença estão de acordo");
    expect(out).toContain("só histórico");
  });

  it("cancelado: sem ações", async () => {
    achar({ status: "cancelado", closed_at: "2026-10-05T15:00:00Z", closed_reason: "desistiu" });
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("cancelado: somente leitura");
  });

  it("rascunho com outro vigente no clube: avisa da substituição", async () => {
    const rascunho = achar({ status: "rascunho" });
    h.history = { data: [rascunho, contrato(3, CLUBE_A)], migrationPending: false };
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("já tem o");
    expect(out).toContain("CT-3");
    expect(out).toContain("será encerrado como substituído");
    expect(out).toContain("Outros contratos do clube");
  });

  it("sem documento: oferece enviar e marca 'sem documento'", async () => {
    achar({ document_path: null });
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("sem documento");
    expect(out).toContain("Enviar PDF");
  });

  it("trilha de auditoria ausente (0072): avisa que as alterações não são registradas", async () => {
    achar();
    h.trail = { data: [], migrationPending: true };
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("Migração 0072 pendente");
    expect(out).toContain("NÃO ficam registradas");
  });

  it("a trilha mostra as ações do contrato em português, com valores formatados", async () => {
    achar();
    h.trail = {
      migrationPending: false,
      data: [
        {
          id: "t1",
          occurred_at: "2026-10-05T15:00:00Z",
          actor_email: "dono@exemplo.com",
          action: "contract.update",
          target_club_id: CLUBE_A,
          target_club_name: "Clube da Praia",
          details: {
            contractId: ID,
            number: 7,
            changes: { price_cents: { from: 14990, to: 19990 }, signer_name: { from: "(omitido)", to: "(omitido)" } },
          },
          ip: null,
        },
      ],
    };
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("Contrato editado");
    expect(out).toContain("Valor por ciclo");
    expect(out).toContain("199,90");
    expect(out).toContain("CT-7");
    expect(out).not.toContain(ID.slice(0, 18) + "-000000000007\"");
  });

  it("clube removido: a página abre e diz que não há licença para comparar", async () => {
    achar({}, null);
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).toContain("Clube removido");
    expect(out).toContain("não existe mais");
  });

  it("não coloca o caminho do PDF no storage na página", async () => {
    achar({ document_path: "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f/7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6/11111111-2222-4333-8444-555555555555.pdf" });
    const out = await render(AdminContratoPage({ params: params(ID) }));
    expect(out).not.toContain("11111111-2222-4333-8444-555555555555");
  });
});
