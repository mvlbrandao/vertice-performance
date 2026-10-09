import { Card } from "@/components/ui/Card";
import type { ConfigGroupView, ConfigImportance } from "@/lib/platform/healthRules";
import { cn } from "@/lib/utils/cn";
import { StatusBadge } from "@/components/admin/health/StatusBadge";

const IMPORTANCE_LABEL: Record<ConfigImportance, string> = {
  required: "obrigatória",
  recommended: "recomendada",
  optional: "opcional",
};

/**
 * Configuração por PRESENÇA. Os valores não chegam a este componente: a
 * entrada só tem nome, importância e um booleano.
 */
export function ConfigChecklist({ groups }: { groups: ConfigGroupView[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.key} className="min-w-0 !p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <b className="text-sm min-w-0">{group.label}</b>
            <StatusBadge level={group.level} label={group.level === "neutro" ? "Desligado" : undefined} />
          </div>
          <p className="m-0 mb-2 text-xs text-ink-soft">{group.summary}</p>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-2 text-xs min-w-0">
                <code className="font-mono break-all min-w-0">{item.name}</code>
                <span
                  className={cn(
                    "shrink-0 text-right",
                    item.present ? "text-[#1A6B3C]" : item.importance === "required" ? "text-[#B02020] font-bold" : "text-ink-faint",
                  )}
                >
                  <span aria-hidden="true">{item.present ? "✓ " : "✕ "}</span>
                  {item.present ? "definida" : "ausente"}
                  <span className="text-ink-faint font-normal"> · {IMPORTANCE_LABEL[item.importance]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
