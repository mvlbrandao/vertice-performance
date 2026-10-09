import { requirePlatformAdmin } from "@/lib/platform/admin";
import { loadHealth } from "@/lib/platform/health";
import { formatAuditTime } from "@/lib/platform/auditLabels";
import { formatCount } from "@/lib/platform/healthFormat";
import {
  DEVICE_LABELS,
  HEALTH_WINDOWS,
  WINDOW_LABELS,
  WINDOW_PERIOD_LABELS,
  healthHref,
  parseDevice,
  parseWindow,
  PROBE_OK_BELOW_MS,
  PROBE_SLOW_BELOW_MS,
  type DeviceFilter,
} from "@/lib/platform/healthRules";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Kpi } from "@/components/admin/Kpi";
import { MigrationNotice } from "@/components/admin/MigrationNotice";
import { ConfigChecklist } from "@/components/admin/health/ConfigChecklist";
import { CronList } from "@/components/admin/health/CronList";
import { ErrorChart } from "@/components/admin/health/ErrorChart";
import { ErrorGroupList } from "@/components/admin/health/ErrorGroupList";
import { FilterTabs } from "@/components/admin/health/FilterTabs";
import { HealthSection } from "@/components/admin/health/HealthSection";
import { IssueList, OverallBadge } from "@/components/admin/health/OverallStatus";
import { ProbeCard } from "@/components/admin/health/ProbeCard";
import { ReadError } from "@/components/admin/health/ReadError";
import { RetentionNotice } from "@/components/admin/health/RetentionNotice";
import { VitalsRoutes } from "@/components/admin/health/VitalsRoutes";

type Search = Promise<{
  janela?: string | string[];
  dispositivo?: string | string[];
}>;

const DEVICES: DeviceFilter[] = ["todos", "mobile", "desktop"];

export default async function AdminSaudePage({ searchParams }: { searchParams: Search }) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const window = parseWindow(params.janela);
  const device = parseDevice(params.dispositivo);

  const health = await loadHealth({ window, device });
  const nowMs = Date.parse(health.generatedAt);

  const windowTabs = HEALTH_WINDOWS.map((w) => ({
    label: WINDOW_LABELS[w],
    href: healthHref(w, device),
    active: w === window,
  }));
  const deviceTabs = DEVICES.map((d) => ({
    label: DEVICE_LABELS[d],
    href: healthHref(window, d),
    active: d === device,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <AdminPageHeader
        title="Saúde técnica"
        description="Erros, latência e rotinas do sistema. Horários de Brasília."
        actions={<OverallBadge level={health.overall} />}
      />

      <IssueList issues={health.issues} level={health.overall} updatedAt={formatAuditTime(health.generatedAt)} />

      {health.retentionPending && <RetentionNotice />}

      <HealthSection
        id="sondas"
        title="Sondas ao vivo"
        description={`Medidas agora, do servidor do Vértice até cada serviço. Normal abaixo de ${PROBE_OK_BELOW_MS} ms; lento abaixo de ${PROBE_SLOW_BELOW_MS / 1000} s; a partir daí, falha.`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {health.probes.map((probe) => (
            <ProbeCard key={probe.key} probe={probe} />
          ))}
        </div>
      </HealthSection>

      <HealthSection
        id="erros"
        title="Erros do servidor"
        description="Falhas de telas, rotas, ações, webhooks e rotinas, agrupadas pela mesma causa."
        actions={<FilterTabs label="Janela de tempo" tabs={windowTabs} />}
      >
        {health.errors.status === "migration_pending" ? (
          <MigrationNotice migration="0074" what="A coleta de erros, Web Vitals e execuções de rotinas ainda não existe no banco." />
        ) : health.errors.status === "error" ? (
          <ReadError what="os erros" message={health.errors.message} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Kpi label="Erros" value={formatCount(health.errors.data.totals.errors)} hint={WINDOW_PERIOD_LABELS[window]} />
              <Kpi label="Avisos" value={formatCount(health.errors.data.totals.warnings)} hint="quedas de conexão e ações de versão antiga" />
              <Kpi
                label="Causas distintas"
                value={`${formatCount(health.errors.data.groups.length)}${health.errors.data.truncated ? "+" : ""}`}
                hint="grupos de falha"
              />
            </div>
            <ErrorChart points={health.errors.data.daily} totals={health.errors.data.totals} />
            <h3 className="text-[16px] mt-5 mb-2">Causas</h3>
            <ErrorGroupList groups={health.errors.data.groups} truncated={health.errors.data.truncated} />
          </>
        )}
      </HealthSection>

      <HealthSection
        id="vitals"
        title="Desempenho no navegador"
        description={`Web Vitals medidos em quem usa o sistema, por tela. Mesma janela dos erros (${WINDOW_LABELS[window]}).`}
        actions={<FilterTabs label="Dispositivo" tabs={deviceTabs} />}
      >
        {health.vitals.status === "migration_pending" ? (
          <MigrationNotice migration="0074" what="A coleta de Web Vitals ainda não existe no banco." />
        ) : health.vitals.status === "error" ? (
          <ReadError what="os Web Vitals" message={health.vitals.message} />
        ) : (
          <VitalsRoutes routes={health.vitals.data.routes} totalRoutes={health.vitals.data.totalRoutes} />
        )}
      </HealthSection>

      <HealthSection
        id="rotinas"
        title="Rotinas agendadas"
        description="Última execução de cada cron. Atrasada: mais de 26 horas sem rodar."
      >
        {health.crons.status === "migration_pending" ? (
          <MigrationNotice migration="0074" what="O registro das execuções das rotinas ainda não existe no banco." />
        ) : health.crons.status === "error" ? (
          <ReadError what="as rotinas" message={health.crons.message} />
        ) : (
          <CronList crons={health.crons.data} nowMs={nowMs} />
        )}
      </HealthSection>

      <HealthSection
        id="configuracao"
        title="Configuração do servidor"
        description="Só mostra se cada variável existe. Os valores nunca aparecem aqui."
      >
        <ConfigChecklist groups={health.config} />
      </HealthSection>
    </div>
  );
}
