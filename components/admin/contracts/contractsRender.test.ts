import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Desenha os componentes de contrato no servidor (sem navegador) para provar o
// que aparece na tela em cada situação: selos, avisos, botões por situação e
// valores iniciais do formulário. Não prova clique nem envio (não há DOM aqui):
// o fluxo de envio do PDF está em lib/platform/contractUpload.test.ts e as
// ações em lib/actions/contracts.test.ts.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
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

import { ContractActions } from "./ContractActions";
import { ContractDocumentPanel } from "./ContractDocumentPanel";
import { ContractFacts } from "./ContractFacts";
import { ContractFiltersForm } from "./ContractFilters";
import { ContractForm, type ClubOption } from "./ContractForm";
import { ContractLicensePanel } from "./ContractLicensePanel";
import { ContractListItem } from "./ContractListItem";
import { defaultNewContractValues } from "@/lib/platform/contractView";
import type { ContractListRow } from "@/lib/platform/contractList";
import type { ContractFilters } from "@/lib/platform/contractFilters";
import type { LicenseSnapshot } from "@/lib/platform/contractRules";

const HOJE = "2026-10-08";

function linha(over: Partial<ContractListRow> = {}): ContractListRow {
  return {
    id: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6",
    number: 7,
    club_id: "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f",
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
    document_path: "x/y/z.pdf",
    notes: null,
    closed_at: null,
    closed_reason: null,
    created_by_email: "dono@exemplo.com",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    club_name: "Clube da Praia",
    club_slug: "praia",
    divergences: [],
    ...over,
  };
}

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("ContractListItem", () => {
  it("mostra número, clube, plano, valor, período e o link para o contrato", () => {
    const out = html(createElement(ContractListItem, { contract: linha(), todayISO: HOJE }));
    expect(out).toContain("CT-7");
    expect(out).toContain("Clube da Praia");
    expect(out).toContain("Plano Clube");
    expect(out).toContain("149,90");
    expect(out).toContain("por mês");
    expect(out).toContain("01/10/2026 a 31/10/2026");
    expect(out).toContain("Vigente");
    expect(out).toContain('href="/admin/contratos/7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6"');
  });

  it("selo de prazo conforme a data de hoje", () => {
    expect(html(createElement(ContractListItem, { contract: linha({ ends_on: "2026-10-20" }), todayISO: HOJE }))).toContain(
      "Vence em 12 dias",
    );
    expect(html(createElement(ContractListItem, { contract: linha({ ends_on: "2026-10-01" }), todayISO: HOJE }))).toContain(
      "Vencido há 7 dias",
    );
  });

  it("anual mostra o valor do ciclo E o equivalente mensal", () => {
    const out = html(
      createElement(ContractListItem, {
        contract: linha({ billing_cycle: "anual", price_cents: 120000 }),
        todayISO: HOJE,
      }),
    );
    expect(out).toContain("1.200,00");
    expect(out).toContain("por ano");
    expect(out).toContain("equivale a");
    expect(out).toContain("100,00");
  });

  it("'sem documento' só para vigente e rascunho sem PDF", () => {
    const sem = (status: ContractListRow["status"]) =>
      html(createElement(ContractListItem, { contract: linha({ status, document_path: null }), todayISO: HOJE }));
    expect(sem("vigente")).toContain("sem documento");
    expect(sem("rascunho")).toContain("sem documento");
    expect(sem("encerrado")).not.toContain("sem documento");
    expect(sem("cancelado")).not.toContain("sem documento");
    expect(html(createElement(ContractListItem, { contract: linha(), todayISO: HOJE }))).not.toContain("sem documento");
  });

  it("divergência: selo e a primeira mensagem, com contagem do resto", () => {
    const out = html(
      createElement(ContractListItem, {
        contract: linha({
          divergences: [
            { code: "preco", severity: "alerta", message: "O contrato vale R$ 99,00 por mês, mas a licença cobra R$ 149,90 por mês." },
            { code: "cota", severity: "alerta", message: "O contrato prevê 10 atletas, mas a licença permite 50." },
          ],
        }),
        todayISO: HOJE,
      }),
    );
    expect(out).toContain("diverge da licença");
    expect(out).toContain("O contrato vale R$ 99,00 por mês");
    expect(out).toContain("+1 divergência");
  });

  it("sem divergência não aparece selo", () => {
    expect(html(createElement(ContractListItem, { contract: linha(), todayISO: HOJE }))).not.toContain("diverge da licença");
  });

  it("não vaza e-mail de quem criou nem notas internas na lista", () => {
    const out = html(
      createElement(ContractListItem, { contract: linha({ notes: "negociado por telefone", signer_name: "Maria" }), todayISO: HOJE }),
    );
    expect(out).not.toContain("dono@exemplo.com");
    expect(out).not.toContain("negociado por telefone");
    expect(out).not.toContain("Maria");
  });

  it("alvo de toque: o botão Abrir usa o piso de 44px em ponteiro grosso", () => {
    expect(html(createElement(ContractListItem, { contract: linha(), todayISO: HOJE }))).toContain("pointer-coarse:min-h-11");
  });
});

describe("ContractFiltersForm", () => {
  const todos: ContractFilters = { q: "", status: "todos", vencimento: "todos", ciclo: "todos", documento: "todos" };

  it("é um formulário GET para a própria lista", () => {
    const out = html(createElement(ContractFiltersForm, { filters: todos }));
    expect(out).toContain('method="get"');
    expect(out).toContain('action="/admin/contratos"');
    for (const nome of ["q", "status", "vencimento", "ciclo", "documento"]) expect(out).toContain(`name="${nome}"`);
  });

  it("sem filtro ativo não mostra 'Limpar'; com filtro mostra e preserva a escolha", () => {
    expect(html(createElement(ContractFiltersForm, { filters: todos }))).not.toContain("Limpar");
    const out = html(
      createElement(ContractFiltersForm, { filters: { ...todos, q: "praia", status: "vigente", vencimento: "30" } }),
    );
    expect(out).toContain("Limpar");
    expect(out).toContain('value="praia"');
    expect(out).toMatch(/<option value="vigente" selected/);
    expect(out).toMatch(/<option value="30" selected/);
  });

  it("oferece as opções de vencimento do dono (30, 60, 90 e vencidos)", () => {
    const out = html(createElement(ContractFiltersForm, { filters: todos }));
    for (const rotulo of ["Vencem em 30 dias", "Vencem em 60 dias", "Vencem em 90 dias", "Vencidos"]) {
      expect(out).toContain(rotulo);
    }
  });
});

const licenca: LicenseSnapshot = {
  status: "ativo",
  allowed: true,
  courtesyActive: false,
  courtesyUntil: null,
  priceCents: 14990,
  maxAthletes: 50,
  defaultMaxAthletes: 50,
  isDemo: false,
};
const comparavel = { status: "vigente" as const, price_cents: 14990, max_athletes: null, billing_cycle: "mensal" as const };

describe("ContractLicensePanel", () => {
  it("de acordo: diz que estão de acordo", () => {
    const out = html(
      createElement(ContractLicensePanel, { contract: comparavel, license: licenca, divergences: [], clubSlug: "praia", defaultQuota: 50 }),
    );
    expect(out).toContain("Contrato e licença estão de acordo");
    expect(out).toContain("acesso liberado");
    expect(out).toContain("/admin/clubes?q=praia");
  });

  it("divergências aparecem explicadas e a diferença é anunciada a leitores de tela", () => {
    const out = html(
      createElement(ContractLicensePanel, {
        contract: { ...comparavel, price_cents: 9900 },
        license: { ...licenca, status: "bloqueado", allowed: false },
        divergences: [
          { code: "preco", severity: "alerta", message: "O contrato vale R$ 99,00 por mês, mas a licença cobra R$ 149,90 por mês." },
          { code: "licenca_sem_acesso", severity: "alerta", message: "O contrato está vigente, mas o clube está bloqueado: a licença não permite o uso do sistema." },
        ],
        clubSlug: null,
        defaultQuota: 50,
      }),
    );
    expect(out).toContain("sem acesso");
    expect(out).toContain("O contrato vale R$ 99,00 por mês");
    expect(out).toContain("o clube está bloqueado");
    expect(out).toContain("(diverge do contrato)");
    expect(out).not.toContain("estão de acordo");
    expect(out).not.toContain("/admin/clubes?q=");
  });

  it("cortesia vira selo e o aviso fica em amarelo, não vermelho", () => {
    const out = html(
      createElement(ContractLicensePanel, {
        contract: comparavel,
        license: { ...licenca, courtesyActive: true, courtesyUntil: "2026-12-31" },
        divergences: [{ code: "cortesia", severity: "aviso", message: "O clube está em cortesia até 31/12/2026." }],
        clubSlug: "praia",
        defaultQuota: 50,
      }),
    );
    expect(out).toContain("cortesia até 31/12/2026");
    expect(out).toContain("Atenção");
    expect(out).not.toContain(">Divergência<");
  });

  it("clube removido: sem licença para comparar", () => {
    const out = html(createElement(ContractLicensePanel, { contract: comparavel, license: null, divergences: [], clubSlug: null, defaultQuota: 50 }));
    expect(out).toContain("não existe mais");
  });
});

describe("ContractFacts", () => {
  it("encerrado mostra quando e por que terminou", () => {
    const out = html(
      createElement(ContractFacts, {
        contract: linha({ status: "encerrado", closed_at: "2026-10-05T15:00:00Z", closed_reason: "Substituído pelo CT-8" }),
        defaultQuota: 50,
      }),
    );
    expect(out).toContain("Encerrado em");
    expect(out).toContain("05/10/2026");
    expect(out).toContain("Substituído pelo CT-8");
  });

  it("cota vazia mostra a cota padrão; notas aparecem em leitura", () => {
    const out = html(createElement(ContractFacts, { contract: linha({ notes: "linha 1\nlinha 2" }), defaultQuota: 50 }));
    expect(out).toContain("50 (padrão do plano)");
    expect(out).toContain("linha 1");
    expect(out).toContain("whitespace-pre-wrap");
  });
});

describe("ContractActions", () => {
  const base = { contractId: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6", number: 7 };
  const botoes = (out: string) => [...out.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  const periodo = { startsOn: "2026-11-01", endsOn: "2026-11-30" };

  it("rascunho: ativar e cancelar", () => {
    expect(botoes(html(createElement(ContractActions, { ...base, status: "rascunho", renewal: null })))).toEqual([
      "Ativar",
      "Cancelar contrato",
    ]);
  });

  it("vigente com fim: renovar, encerrar e cancelar", () => {
    expect(botoes(html(createElement(ContractActions, { ...base, status: "vigente", renewal: periodo })))).toEqual([
      "Renovar",
      "Encerrar",
      "Cancelar contrato",
    ]);
  });

  it("vigente por prazo indeterminado não renova", () => {
    expect(botoes(html(createElement(ContractActions, { ...base, status: "vigente", renewal: null })))).toEqual([
      "Encerrar",
      "Cancelar contrato",
    ]);
  });

  it("encerrado só renova; cancelado e encerrado sem renovação ficam somente leitura", () => {
    expect(botoes(html(createElement(ContractActions, { ...base, status: "encerrado", renewal: periodo })))).toEqual(["Renovar"]);
    const sem = html(createElement(ContractActions, { ...base, status: "encerrado", renewal: null }));
    expect(botoes(sem)).toEqual([]);
    expect(sem).toContain("somente leitura");
    expect(html(createElement(ContractActions, { ...base, status: "cancelado", renewal: null }))).toContain("cancelado: somente leitura");
  });
});

describe("ContractDocumentPanel", () => {
  const base = { contractId: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6", number: 7 };
  const botoes = (out: string) => [...out.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

  it("sem documento e editável: só enviar", () => {
    const out = html(createElement(ContractDocumentPanel, { ...base, hasDocument: false, editable: true }));
    expect(botoes(out)).toEqual(["Enviar PDF"]);
    expect(out).toContain("Nenhum documento anexado");
    expect(out).toContain('accept="application/pdf,.pdf"');
    expect(out).toContain("até 10 MB");
  });

  it("com documento e editável: baixar, substituir e remover", () => {
    const out = html(createElement(ContractDocumentPanel, { ...base, hasDocument: true, editable: true }));
    expect(botoes(out)).toEqual(["Baixar", "Substituir PDF", "Remover"]);
    expect(out).toContain("contrato-CT-7.pdf");
  });

  it("contrato final (somente leitura) só baixa, e não oferece escolher arquivo", () => {
    const out = html(createElement(ContractDocumentPanel, { ...base, hasDocument: true, editable: false }));
    expect(botoes(out)).toEqual(["Baixar"]);
    expect(out).not.toContain('type="file"');
  });

  it("nunca expõe o caminho do arquivo no storage", () => {
    const out = html(createElement(ContractDocumentPanel, { ...base, hasDocument: true, editable: true }));
    expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{36}\.pdf/);
  });
});

describe("ContractForm", () => {
  const clubes: ClubOption[] = [
    { id: "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f", name: "Clube da Praia", activeNumber: 1 },
    { id: "aaaaaaaa-8a47-4d1e-9c55-0a1b2c3d4e5f", name: "Costa Azul", activeNumber: null },
  ];
  const valores = defaultNewContractValues({ planName: "Vértice Clube", priceCents: 14990 }, HOJE);

  it("criação: plano, preço e cota padrão vêm das configurações; início hoje", () => {
    const out = html(
      createElement(ContractForm, { mode: "create", clubs: clubes, initialClubId: null, values: valores, defaultQuota: 50 }),
    );
    expect(out).toContain('value="Vértice Clube"');
    expect(out).toContain('value="149,90"');
    expect(out).toContain('value="2026-10-08"');
    expect(out).toContain('value="2026-11-07"');
    expect(out).toContain("padrão: 50");
    expect(out).toContain("Vazio = cota padrão do plano (50 atletas)");
    expect(out).toContain("Criar contrato");
  });

  it("lista os clubes e avisa quais já têm contrato vigente", () => {
    const out = html(
      createElement(ContractForm, { mode: "create", clubs: clubes, initialClubId: null, values: valores, defaultQuota: 50 }),
    );
    expect(out).toContain("Clube da Praia (tem CT-1 vigente)");
    expect(out).toContain(">Costa Azul<");
  });

  it("?clubId= pré-seleciona o clube", () => {
    const out = html(
      createElement(ContractForm, {
        mode: "create",
        clubs: clubes,
        initialClubId: "aaaaaaaa-8a47-4d1e-9c55-0a1b2c3d4e5f",
        values: valores,
        defaultQuota: 50,
      }),
    );
    expect(out).toMatch(/<option value="aaaaaaaa-8a47-4d1e-9c55-0a1b2c3d4e5f" selected/);
    expect(out).not.toMatch(/<option value="3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f" selected/);
  });

  it("ciclo anual mostra o equivalente mensal do valor digitado", () => {
    const out = html(
      createElement(ContractForm, {
        mode: "create",
        clubs: clubes,
        initialClubId: null,
        values: { ...valores, billingCycle: "anual", priceReais: "1.200,00" },
        defaultQuota: 50,
      }),
    );
    expect(out).toContain("Equivale a");
    expect(out).toContain("100,00");
  });

  it("todo campo tem rótulo ligado ao controle (label envolvendo)", () => {
    const out = html(
      createElement(ContractForm, { mode: "create", clubs: clubes, initialClubId: null, values: valores, defaultQuota: 50 }),
    );
    expect(out.match(/<label/g)!.length).toBeGreaterThanOrEqual(12);
    expect(out).toContain("Valor de cada ciclo (R$)");
  });

  it("usa os limites de tamanho do esquema nos campos de texto", () => {
    const out = html(
      createElement(ContractForm, { mode: "create", clubs: clubes, initialClubId: null, values: valores, defaultQuota: 50 }),
    );
    expect(out).toContain('maxLength="80"');
    expect(out).toContain('maxLength="2000"');
  });

  it("edição de vigente avisa da trilha e traz os valores gravados; não pede clube", () => {
    const out = html(
      createElement(ContractForm, {
        mode: "edit",
        contractId: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6",
        status: "vigente",
        values: { ...valores, planName: "Plano Ouro", maxAthletes: "80", notes: "reajustado" },
        defaultQuota: 50,
      }),
    );
    expect(out).toContain("fica registrada na trilha de auditoria");
    expect(out).toContain('value="Plano Ouro"');
    expect(out).toContain('value="80"');
    expect(out).toContain("reajustado");
    expect(out).toContain("Salvar alterações");
    expect(out).not.toContain('name="clubId"');
    expect(out).not.toContain('name="status"');
  });

  it("edição de rascunho não mostra o aviso da trilha", () => {
    const out = html(
      createElement(ContractForm, {
        mode: "edit",
        contractId: "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6",
        status: "rascunho",
        values: valores,
        defaultQuota: 50,
      }),
    );
    expect(out).not.toContain("fica registrada na trilha");
  });
});
