import { describe, expect, it } from "vitest";
import {
  REMOVED_CLUB_NAME,
  buildContractListRows,
  clubsWithoutActiveContract,
} from "@/lib/platform/contractList";
import type { ClubContractRow, ContractClub } from "@/lib/platform/contracts";

const AGORA = new Date("2026-10-08T15:00:00Z");
const PADRAO = { priceCents: 14990, maxAthletes: 50 };

function clube(id: string, over: Partial<ContractClub> = {}): ContractClub {
  return {
    id,
    name: `Clube ${id}`,
    slug: `slug-${id}`,
    status: "ativo",
    trial_ends_at: null,
    courtesy_until: null,
    max_athletes_override: null,
    price_cents_override: null,
    is_demo: false,
    ...over,
  };
}

function contrato(id: string, clubId: string, over: Partial<ClubContractRow> = {}): ClubContractRow {
  return {
    id,
    number: 1,
    club_id: clubId,
    status: "vigente",
    plan_name: "Plano",
    price_cents: 14990,
    max_athletes: null,
    billing_cycle: "mensal",
    starts_on: "2026-10-01",
    ends_on: null,
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
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("buildContractListRows", () => {
  it("anexa nome e endereço do clube", () => {
    const [row] = buildContractListRows([contrato("c1", "a")], [clube("a", { name: "Praia FC", slug: "praia" })], PADRAO, AGORA);
    expect(row).toMatchObject({ id: "c1", club_name: "Praia FC", club_slug: "praia" });
  });

  it("clube que não existe mais não derruba a lista", () => {
    const [row] = buildContractListRows([contrato("c1", "sumiu")], [], PADRAO, AGORA);
    expect(row.club_name).toBe(REMOVED_CLUB_NAME);
    expect(row.club_slug).toBe("");
    expect(row.divergences).toEqual([]);
  });

  it("contrato vigente de acordo com a licença não diverge", () => {
    const [row] = buildContractListRows([contrato("c1", "a")], [clube("a")], PADRAO, AGORA);
    expect(row.divergences).toEqual([]);
  });

  it("vigente com preço diferente da licença diverge", () => {
    const [row] = buildContractListRows([contrato("c1", "a", { price_cents: 9900 })], [clube("a")], PADRAO, AGORA);
    expect(row.divergences.map((d) => d.code)).toEqual(["preco"]);
  });

  it("vigente em clube bloqueado acusa licença sem acesso", () => {
    const [row] = buildContractListRows([contrato("c1", "a")], [clube("a", { status: "bloqueado" })], PADRAO, AGORA);
    expect(row.divergences.map((d) => d.code)).toEqual(["licenca_sem_acesso"]);
  });

  it("rascunho, encerrado e cancelado não são comparados na lista", () => {
    for (const status of ["rascunho", "encerrado", "cancelado"] as const) {
      const [row] = buildContractListRows([contrato("c1", "a", { status, price_cents: 1 })], [clube("a")], PADRAO, AGORA);
      expect(row.divergences, status).toEqual([]);
    }
  });

  it("preço próprio do clube entra na comparação", () => {
    const [row] = buildContractListRows(
      [contrato("c1", "a", { price_cents: 9900 })],
      [clube("a", { price_cents_override: 9900 })],
      PADRAO,
      AGORA,
    );
    expect(row.divergences).toEqual([]);
  });

  it("mantém a ordem recebida e não altera a entrada", () => {
    const entrada = [contrato("c2", "a", { number: 2 }), contrato("c1", "b", { number: 1 })];
    const copia = structuredClone(entrada);
    const rows = buildContractListRows(entrada, [clube("a"), clube("b")], PADRAO, AGORA);
    expect(rows.map((r) => r.id)).toEqual(["c2", "c1"]);
    expect(entrada).toEqual(copia);
  });
});

describe("clubsWithoutActiveContract", () => {
  it("lista clube pago (ativo ou atrasado) sem contrato vigente, por nome", () => {
    const clubs = [
      clube("a", { name: "Zeta", status: "ativo" }),
      clube("b", { name: "Alfa", status: "atrasado" }),
      clube("c", { name: "Em teste", status: "trial", trial_ends_at: "2026-12-01T00:00:00Z" }),
      clube("d", { name: "Bloqueado", status: "bloqueado" }),
      clube("e", { name: "Cancelado", status: "cancelado" }),
    ];
    expect(clubsWithoutActiveContract(clubs, [], PADRAO, AGORA).map((c) => c.name)).toEqual(["Alfa", "Zeta"]);
  });

  it("quem já tem contrato vigente sai da lista; rascunho e encerrado não contam", () => {
    const clubs = [clube("a"), clube("b"), clube("c")];
    const contracts = [
      { club_id: "a", status: "vigente" as const },
      { club_id: "b", status: "rascunho" as const },
      { club_id: "c", status: "encerrado" as const },
    ];
    expect(clubsWithoutActiveContract(clubs, contracts, PADRAO, AGORA).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("clube de demonstração nunca aparece", () => {
    expect(clubsWithoutActiveContract([clube("a", { is_demo: true })], [], PADRAO, AGORA)).toEqual([]);
  });

  it("devolve a situação do clube para a tela explicar o motivo", () => {
    expect(clubsWithoutActiveContract([clube("a", { status: "atrasado" })], [], PADRAO, AGORA)).toEqual([
      { id: "a", name: "Clube a", status: "atrasado" },
    ]);
  });
});
