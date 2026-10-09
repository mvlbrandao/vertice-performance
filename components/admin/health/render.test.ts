import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CronView } from "@/lib/platform/health";
import {
  CONFIG_GROUPS,
  checkConfig,
  fillDailySeries,
  pivotVitals,
  toErrorGroupViews,
  type ErrorGroupRow,
  type VitalSummaryRow,
} from "@/lib/platform/healthRules";
import { ConfigChecklist } from "./ConfigChecklist";
import { CronList } from "./CronList";
import { ErrorChart } from "./ErrorChart";
import { ErrorGroupList, MAX_GROUPS_SHOWN } from "./ErrorGroupList";
import { FilterTabs } from "./FilterTabs";
import { IssueList, OverallBadge } from "./OverallStatus";
import { ProbeCard } from "./ProbeCard";
import { RetentionNotice } from "./RetentionNotice";
import { VitalsRoutes } from "./VitalsRoutes";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const grupoBase: ErrorGroupRow = {
  fingerprint: "abcdef0123456789abcdef0123456789",
  source: "route",
  route: "/athletes/:id/dados",
  severity: "error",
  occurrences: 1_234,
  clubs_affected: 0,
  first_seen: "2026-10-08T05:30:00Z",
  last_seen: "2026-10-08T15:31:00Z",
  sample_message: "falha ao ler",
  sample_digest: "987654",
};

describe("ErrorGroupList", () => {
  it("mensagem com HTML aparece como TEXTO escapado, nunca como marcação", () => {
    const groups = toErrorGroupViews([
      { ...grupoBase, sample_message: '<img src=x onerror="alert(1)"><script>alert(2)</script>' },
    ]);
    const out = html(h(ErrorGroupList, { groups, truncated: false }));
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;img");
  });

  it("mostra ocorrências, rota, origem, digest, primeira e última vez (horário de Brasília)", () => {
    const out = html(h(ErrorGroupList, { groups: toErrorGroupViews([grupoBase]), truncated: false }));
    expect(out).toContain("1.234");
    expect(out).toContain("/athletes/:id/dados");
    expect(out).toContain("Rota de API");
    expect(out).toContain("987654");
    expect(out).toContain("08/10/2026 02:30:00");
    expect(out).toContain("08/10/2026 12:31:00");
    expect(out).toContain("Erro");
  });

  it("sem clube identificado mostra travessão, não zero", () => {
    const out = html(h(ErrorGroupList, { groups: toErrorGroupViews([grupoBase]), truncated: false }));
    expect(out).toContain(">—<");
  });

  it("estado vazio explica que não há grupos", () => {
    expect(html(h(ErrorGroupList, { groups: [], truncated: false }))).toContain("Nenhum grupo de erro");
  });

  it("limita a lista e avisa quantos existem", () => {
    const muitos = Array.from({ length: MAX_GROUPS_SHOWN + 5 }, (_, i) =>
      ({ ...grupoBase, fingerprint: `${String(i).padStart(8, "0")}${"a".repeat(24)}` }),
    );
    const out = html(h(ErrorGroupList, { groups: toErrorGroupViews(muitos), truncated: false }));
    expect(out.match(/<article/g)).toHaveLength(MAX_GROUPS_SHOWN);
    expect(out).toContain(`Mostrando ${MAX_GROUPS_SHOWN} de ${MAX_GROUPS_SHOWN + 5}`);
  });
});

describe("ErrorChart", () => {
  const points = fillDailySeries(
    [
      { day: "2026-10-06", errors: 4, warnings: 1 },
      { day: "2026-10-08", errors: 2, warnings: 0 },
    ],
    "2026-10-08",
    7,
  );

  it("vazio: estado que explica que a coleta começa após o deploy", () => {
    const out = html(h(ErrorChart, { points, totals: { errors: 0, warnings: 0 } }));
    expect(out).toContain("Nenhum erro nem aviso");
    expect(out).toContain("começa após o deploy");
  });

  it("com dados: legenda das duas séries, uma coluna por dia e a tabela alternativa", () => {
    const out = html(h(ErrorChart, { points, totals: { errors: 6, warnings: 1 } }));
    expect(out).toContain("Erros (6)");
    expect(out).toContain("Avisos (1)");
    expect(out).toContain("Ver como tabela");
    expect(out).toContain("<table");
    // 8 datas (7 dias para trás + hoje) na tabela.
    expect(out.match(/<th scope="row"/g)).toHaveLength(8);
    expect(out).toContain("hoje, até agora");
  });

  it("aviso leva listras (não depende só de cor) e a barra é limitada a 24 px (max-w-6)", () => {
    const out = html(h(ErrorChart, { points, totals: { errors: 6, warnings: 1 } }));
    expect(out).toContain("repeating-linear-gradient");
    expect(out).toContain("max-w-6");
  });
});

describe("VitalsRoutes", () => {
  const linha = (extra: Partial<VitalSummaryRow>): VitalSummaryRow => ({
    route: "/admin/clubes/:id",
    metric: "LCP",
    device: "mobile",
    samples: 42,
    p50: 1_900,
    p75: 3_100,
    p95: 6_200,
    poor_pct: 12.5,
    ...extra,
  });

  it("p50, p75 e p95 aparecem com o nível por extenso (cor nunca sozinha)", () => {
    const routes = pivotVitals([linha({})], "todos");
    const out = html(h(VitalsRoutes, { routes, totalRoutes: 1 }));
    expect(out).toContain("/admin/clubes/:id");
    expect(out).toContain("Celular");
    expect(out).toContain("3,1 s");
    expect(out).toContain("(Atenção)");
    expect(out).toContain("(Ruim)");
    expect(out).toContain("(Bom)");
    expect(out).toContain("42 medidas");
    expect(out).toContain("12,5% ruins");
    expect(out).toContain("sem medidas");
  });

  it("CLS sem unidade", () => {
    const routes = pivotVitals([linha({ metric: "CLS", p50: 0.01, p75: 0.12, p95: 0.4 })], "todos");
    expect(html(h(VitalsRoutes, { routes, totalRoutes: 1 }))).toContain("0,12");
  });

  it("vazio: estado que explica a coleta", () => {
    const out = html(h(VitalsRoutes, { routes: [], totalRoutes: 0 }));
    expect(out).toContain("Nenhuma medida");
    expect(out).toContain("começa após o deploy");
  });

  it("avisa quando há mais telas do que as listadas", () => {
    const routes = pivotVitals([linha({})], "todos");
    expect(html(h(VitalsRoutes, { routes, totalRoutes: 40 }))).toContain("Mostrando as 1 telas mais usadas de 40");
  });
});

describe("CronList", () => {
  const agora = Date.parse("2026-10-08T15:00:00Z");
  const retencaoFalhou: CronView = {
    job: "club-retention",
    label: "Expurgo de clubes cancelados e demonstração",
    schedule: "todo dia, 02h30 (Brasília)",
    state: "falhou",
    level: "critico",
    lastRun: {
      id: 9,
      job: "club-retention",
      started_at: "2026-10-08T05:30:00Z",
      finished_at: "2026-10-08T05:31:00Z",
      ok: false,
      duration_ms: 60_000,
      summary: { retencao: "pendente", apagados: 0 },
      error: '<b>falha ao apagar o clube</b>: 409',
    },
    recent: [
      {
        id: 9,
        job: "club-retention",
        started_at: "2026-10-08T05:30:00Z",
        finished_at: "2026-10-08T05:31:00Z",
        ok: false,
        duration_ms: 60_000,
        summary: {},
        error: null,
      },
    ],
    summary: [{ label: "Retenção da telemetria", value: "pendente (função não aplicada)" }],
  };
  const semExecucao: CronView = {
    job: "billing-reminders",
    label: "Lembretes de cobrança",
    schedule: "todo dia, 09h (Brasília)",
    state: "sem_execucao",
    level: "neutro",
    lastRun: null,
    recent: [],
    summary: [],
  };

  it("mostra a falha, o erro como texto e o resumo", () => {
    const out = html(h(CronList, { crons: [retencaoFalhou, semExecucao], nowMs: agora }));
    expect(out).toContain("Falhou");
    expect(out).toContain("&lt;b&gt;falha ao apagar o clube&lt;/b&gt;");
    expect(out).not.toContain("<b>falha ao apagar");
    expect(out).toContain("pendente (função não aplicada)");
    expect(out).toContain("há 9 h");
    expect(out).toContain("duração 1 min");
  });

  it("cron sem execução explica que a coleta começa após o deploy", () => {
    const out = html(h(CronList, { crons: [semExecucao], nowMs: agora }));
    expect(out).toContain("Sem execuções");
    expect(out).toContain("começa após o deploy");
  });
});

describe("ConfigChecklist", () => {
  it("lista nomes e presença, nunca valores", () => {
    const env = Object.fromEntries(CONFIG_GROUPS.flatMap((g) => g.vars.map((v) => [v.name, "valor-super-secreto"])));
    delete (env as Record<string, string | undefined>).CRON_SECRET;
    const out = html(h(ConfigChecklist, { groups: checkConfig(env) }));
    expect(out).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(out).toContain("definida");
    expect(out).toContain("ausente");
    expect(out).not.toContain("valor-super-secreto");
  });
});

describe("OverallBadge / IssueList / ProbeCard / RetentionNotice / FilterTabs", () => {
  it("semáforo geral tem texto, não só cor", () => {
    expect(html(h(OverallBadge, { level: "ok" }))).toContain("Tudo certo");
    expect(html(h(OverallBadge, { level: "atencao" }))).toContain("Atenção");
    expect(html(h(OverallBadge, { level: "critico" }))).toContain("Há problemas");
  });

  it("lista os problemas ou confirma que não há", () => {
    const comProblema = html(
      h(IssueList, {
        issues: [{ level: "critico", text: "Banco de dados: falha" }],
        level: "critico",
        updatedAt: "08/10/2026 12:00:00",
      }),
    );
    expect(comProblema).toContain("Banco de dados: falha");
    expect(comProblema).toContain("Crítico:");
    expect(html(h(IssueList, { issues: [], level: "ok", updatedAt: "x" }))).toContain("Nenhum problema");
  });

  it("sonda mostra latência, mediana/máximo e o motivo da falha como texto", () => {
    const out = html(
      h(ProbeCard, {
        probe: {
          key: "database",
          label: "Banco de dados",
          status: "lento",
          latencyMs: 450,
          maxMs: 1_300,
          samples: 3,
          detail: "<i>aviso</i>",
        },
      }),
    );
    expect(out).toContain("450 ms");
    expect(out).toContain("mediana de 3 consultas");
    expect(out).toContain("1,3 s");
    expect(out).toContain("Lento");
    expect(out).toContain("&lt;i&gt;aviso&lt;/i&gt;");
  });

  it("aviso de retenção pendente cita a função e o docs/ADMIN.md", () => {
    const out = html(h(RetentionNotice, {}));
    expect(out).toContain("Retenção da telemetria pendente");
    expect(out).toContain("platform_prune_telemetry");
    expect(out).toContain("docs/ADMIN.md");
  });

  it("filtro marca a aba ativa e tem alvo de toque de 44 px em ponteiro grosso", () => {
    const out = html(
      h(FilterTabs, {
        label: "Janela de tempo",
        tabs: [
          { label: "24 horas", href: "/admin/saude", active: true },
          { label: "7 dias", href: "/admin/saude?janela=7d", active: false },
        ],
      }),
    );
    expect(out).toContain('aria-current="page"');
    expect(out).toContain("pointer-coarse:min-h-11");
    expect(out).toContain('href="/admin/saude?janela=7d"');
  });
});
