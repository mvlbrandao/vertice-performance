import { describe, expect, it } from "vitest";
import { computeOverviewMetrics, type MetricsClub } from "./overviewMetrics";

const HOJE = "2026-10-08";

function club(over: Partial<MetricsClub> = {}): MetricsClub {
  return {
    status: "trial",
    is_demo: false,
    created_at: "2026-10-01T12:00:00Z",
    converted_at: null,
    price_cents_override: null,
    ...over,
  };
}

describe("computeOverviewMetrics", () => {
  it("lista vazia zera tudo e não divide por zero", () => {
    expect(computeOverviewMetrics([], 14990, HOJE)).toEqual({
      clientes: 0,
      demos: 0,
      pagantes: 0,
      emTeste: 0,
      receitaRecorrenteCents: 0,
      cohort30: 0,
      conversoes30: 0,
      cohort90: 0,
      conversoes90: 0,
      tempoMedioConversaoDias: null,
    });
  });

  it("soma a mensalidade dos pagantes, com preço próprio quando houver", () => {
    const m = computeOverviewMetrics(
      [
        club({ status: "ativo" }),
        club({ status: "ativo", price_cents_override: 9900 }),
        club({ status: "ativo", price_cents_override: 0 }),
        club({ status: "trial" }),
        club({ status: "atrasado" }),
        club({ status: "cancelado" }),
      ],
      14990,
      HOJE,
    );
    expect(m.pagantes).toBe(3);
    // 14990 + 9900 + 0: preço próprio zero (cortesia comercial) é zero, não "usa o padrão".
    expect(m.receitaRecorrenteCents).toBe(24890);
    expect(m.emTeste).toBe(1);
  });

  it("clube de demonstração não é cliente, nem pagante, nem receita", () => {
    const m = computeOverviewMetrics(
      [club({ status: "ativo", is_demo: true }), club({ status: "ativo" })],
      10000,
      HOJE,
    );
    expect(m.clientes).toBe(1);
    expect(m.demos).toBe(1);
    expect(m.pagantes).toBe(1);
    expect(m.receitaRecorrenteCents).toBe(10000);
  });

  it("conversão da coorte conta ativo e atrasado, e respeita a janela de dias", () => {
    const m = computeOverviewMetrics(
      [
        club({ status: "ativo", created_at: "2026-10-01T00:00:00Z" }), // 30d e 90d
        club({ status: "atrasado", created_at: "2026-09-20T00:00:00Z" }), // 30d e 90d
        club({ status: "trial", created_at: "2026-09-25T00:00:00Z" }), // 30d e 90d, não converteu
        club({ status: "ativo", created_at: "2026-08-01T00:00:00Z" }), // só 90d
        club({ status: "ativo", created_at: "2026-01-01T00:00:00Z" }), // fora das duas
      ],
      1,
      HOJE,
    );
    expect(m.cohort30).toBe(3);
    expect(m.conversoes30).toBe(2);
    expect(m.cohort90).toBe(4);
    expect(m.conversoes90).toBe(3);
  });

  it("tempo médio de conversão em dias, arredondado, só de quem converteu", () => {
    const m = computeOverviewMetrics(
      [
        club({ created_at: "2026-09-01T00:00:00Z", converted_at: "2026-09-05T00:00:00Z" }), // 4
        club({ created_at: "2026-09-01T00:00:00Z", converted_at: "2026-09-12T00:00:00Z" }), // 11
        club({ created_at: "2026-09-01T00:00:00Z", converted_at: null }),
        club({
          is_demo: true,
          created_at: "2026-09-01T00:00:00Z",
          converted_at: "2026-09-02T00:00:00Z",
        }),
      ],
      1,
      HOJE,
    );
    expect(m.tempoMedioConversaoDias).toBe(8); // (4 + 11) / 2 = 7,5 -> 8
  });
});
