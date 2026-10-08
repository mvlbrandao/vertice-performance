import type { ReactNode } from "react";

/** Cabeçalho padrão das telas de administração (mesmo desenho das telas do clube). */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[28px] m-0">{title}</h1>
        {description && <div className="text-xs text-ink-faint mt-0.5">{description}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
