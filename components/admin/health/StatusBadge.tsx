import { cn } from "@/lib/utils/cn";
import type { HealthLevel } from "@/lib/platform/healthRules";
import { LEVEL_STYLE } from "@/components/admin/health/levels";

/** Selo de estado: símbolo + texto + cor. `label` troca o texto padrão do nível (ex.: "Lento", "Falhou"). */
export function StatusBadge({
  level,
  label,
  className,
}: {
  level: HealthLevel;
  label?: string;
  className?: string;
}) {
  const style = LEVEL_STYLE[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 whitespace-nowrap",
        style.badge,
        className,
      )}
    >
      <span aria-hidden="true">{style.symbol}</span>
      {label ?? style.label}
    </span>
  );
}
