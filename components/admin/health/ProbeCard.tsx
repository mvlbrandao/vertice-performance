import { Card } from "@/components/ui/Card";
import { formatMs } from "@/lib/platform/healthFormat";
import { probeLevel, type ProbeResult } from "@/lib/platform/healthRules";
import { StatusBadge } from "@/components/admin/health/StatusBadge";

const STATUS_LABEL = { ok: "Normal", lento: "Lento", falha: "Falha" } as const;

/** Sonda ao vivo de um serviço: latência medida agora, do servidor para o serviço. */
export function ProbeCard({ probe }: { probe: ProbeResult }) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <b className="text-sm min-w-0">{probe.label}</b>
        <StatusBadge level={probeLevel(probe.status)} label={STATUS_LABEL[probe.status]} />
      </div>
      <div className="font-display text-[26px] leading-none">{probe.latencyMs === null ? "—" : formatMs(probe.latencyMs)}</div>
      <div className="text-[11px] text-ink-faint mt-1">
        {probe.samples > 1
          ? `mediana de ${probe.samples} consultas · máximo ${formatMs(probe.maxMs)}`
          : probe.samples === 1
            ? "uma medida"
            : "sem medida"}
      </div>
      {probe.detail && <p className="m-0 mt-2 text-xs text-ink-soft break-words">{probe.detail}</p>}
    </Card>
  );
}
