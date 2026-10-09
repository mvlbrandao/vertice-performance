import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  gate: vi.fn(async () => ({ userId: "u", email: "dono@x.com", fullName: "Dono" })),
  snapshot: null as unknown,
  chamadas: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform/admin", () => ({ requirePlatformAdmin: estado.gate }));
vi.mock("@/lib/platform/health", () => ({
  loadHealth: async (options: unknown) => {
    estado.chamadas.push(options);
    return estado.snapshot;
  },
}));

import AdminSaudePage from "./page";
import type { HealthSnapshot } from "@/lib/platform/health";
import { checkConfig, fillDailySeries, toErrorGroupViews } from "@/lib/platform/healthRules";

const ENV = Object.fromEntries(
  checkConfig({}).flatMap((g) => g.items.map((i) => [i.name, "x"])),
);

function base(extra: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    window: "24h",
    device: "todos",
    generatedAt: "2026-10-08T15:00:00.000Z",
    probes: [
      { key: "database", label: "Banco de dados", status: "ok", latencyMs: 90, maxMs: 120, samples: 3, detail: null },
      { key: "auth", label: "Autenticação (Auth)", status: "ok", latencyMs: 150, maxMs: 190, samples: 3, detail: null },
      { key: "storage", label: "Armazenamento (Storage)", status: "ok", latencyMs: 80, maxMs: 95, samples: 3, detail: null },
    ],
    errors: {
      status: "ok",
      data: {
        groups: toErrorGroupViews([
          {
            fingerprint: "abcdef0123456789abcdef0123456789",
            source: "cron",
            route: "/api/cron/club-retention",
            severity: "error",
            occurrences: 2,
            clubs_affected: 1,
            first_seen: "2026-10-08T05:30:00Z",
            last_seen: "2026-10-08T05:31:00Z",
            sample_message: "falha ao apagar o clube: 409",
            sample_digest: null,
          },
        ]),
        daily: fillDailySeries([{ day: "2026-10-08", errors: 2, warnings: 0 }], "2026-10-08", 1),
        totals: { errors: 2, warnings: 0 },
        truncated: false,
      },
    },
    vitals: { status: "ok", data: { routes: [], totalRoutes: 0 } },
    crons: { status: "ok", data: [] },
    retentionPending: false,
    config: checkConfig(ENV),
    issues: [{ level: "atencao", text: "2 erros nas últimas 24 horas" }],
    overall: "atencao",
    ...extra,
  };
}

async function renderizar(search: Record<string, string> = {}) {
  const element = await AdminSaudePage({ searchParams: Promise.resolve(search) });
  return renderToStaticMarkup(h("div", null, element));
}

afterEach(() => {
  estado.chamadas = [];
  estado.gate.mockClear();
});

describe("/admin/saude", () => {
  it("exige o administrador na primeira linha (antes de ler qualquer dado)", async () => {
    estado.snapshot = base();
    await renderizar();
    expect(estado.gate).toHaveBeenCalledTimes(1);
  });

  it("passa a janela e o dispositivo da URL; valor inválido cai no padrão", async () => {
    estado.snapshot = base();
    await renderizar({ janela: "7d", dispositivo: "mobile" });
    await renderizar({ janela: "90d", dispositivo: "tablet" });
    expect(estado.chamadas).toEqual([
      { window: "7d", device: "mobile" },
      { window: "24h", device: "todos" },
    ]);
  });

  it("monta as seções com semáforo geral, sondas, erros, desempenho, rotinas e configuração", async () => {
    estado.snapshot = base();
    const out = await renderizar();
    expect(out).toContain("Saúde técnica");
    expect(out).toContain("Atenção");
    expect(out).toContain("2 erros nas últimas 24 horas");
    for (const titulo of [
      "Sondas ao vivo",
      "Erros do servidor",
      "Desempenho no navegador",
      "Rotinas agendadas",
      "Configuração do servidor",
    ]) {
      expect(out).toContain(titulo);
    }
    expect(out).toContain("Banco de dados");
    expect(out).toContain("falha ao apagar o clube: 409");
    expect(out).toContain("Nenhuma medida de desempenho");
  });

  it("os filtros preservam um ao outro e marcam o ativo", async () => {
    estado.snapshot = base({ window: "7d", device: "mobile" });
    const out = await renderizar({ janela: "7d", dispositivo: "mobile" });
    expect(out).toContain('href="/admin/saude?janela=30d&amp;dispositivo=mobile"');
    expect(out).toContain('href="/admin/saude?janela=7d&amp;dispositivo=desktop"');
    expect(out).toContain('href="/admin/saude?janela=7d"');
  });

  it("a dica dos erros concorda em gênero com a janela (nunca 'últimas 7 dias')", async () => {
    estado.snapshot = base({ window: "24h" });
    expect(await renderizar()).toContain("nas últimas 24 horas");
    estado.snapshot = base({ window: "7d" });
    expect(await renderizar({ janela: "7d" })).toContain("nos últimos 7 dias");
    estado.snapshot = base({ window: "30d" });
    const out = await renderizar({ janela: "30d" });
    expect(out).toContain("nos últimos 30 dias");
    expect(out).not.toMatch(/últimas (7|30) dias/);
  });

  it("o cartão de avisos descreve o que de fato vira aviso (quedas de conexão, ação de versão antiga), não 4xx", async () => {
    estado.snapshot = base();
    const out = await renderizar();
    expect(out).toContain("quedas de conexão e ações de versão antiga");
    expect(out).not.toContain("4xx");
  });

  it("o aviso de retenção só aparece quando pendente", async () => {
    estado.snapshot = base({ retentionPending: false });
    expect(await renderizar()).not.toContain("Retenção da telemetria pendente");
    estado.snapshot = base({ retentionPending: true });
    const out = await renderizar();
    expect(out).toContain("Retenção da telemetria pendente: aplique");
    expect(out).toContain("platform_prune_telemetry");
  });

  it("migração 0074 ausente: avisos no lugar das seções, sem quebrar a página", async () => {
    estado.snapshot = base({
      errors: { status: "migration_pending" },
      vitals: { status: "migration_pending" },
      crons: { status: "migration_pending" },
    });
    const out = await renderizar();
    expect(out.match(/Migração 0074 pendente/g)).toHaveLength(3);
    expect(out).toContain("Sondas ao vivo");
    expect(out).toContain("Configuração do servidor");
  });

  it("leitura com erro mostra o motivo como texto e o resto da página continua", async () => {
    estado.snapshot = base({ errors: { status: "error", message: "<script>x</script> timeout" } });
    const out = await renderizar();
    expect(out).toContain("Não foi possível ler os erros");
    expect(out).toContain("&lt;script&gt;x&lt;/script&gt; timeout");
    expect(out).not.toContain("<script>x");
    expect(out).toContain("Rotinas agendadas");
  });

  it("uma sonda com falha aparece com o motivo", async () => {
    const s = base();
    s.probes[0] = { ...s.probes[0], status: "falha", latencyMs: null, detail: "sem resposta em 5 s" };
    s.issues = [{ level: "critico", text: "Banco de dados: falha" }];
    s.overall = "critico";
    estado.snapshot = s;
    const out = await renderizar();
    expect(out).toContain("sem resposta em 5 s");
    expect(out).toContain("Há problemas");
  });
});
