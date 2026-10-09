import type { ReactNode } from "react";

/** Seção da tela: título, uma linha de apoio e o conteúdo. `id` serve de âncora. */
export function HealthSection({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-8 first:mt-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-3">
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-[19px] m-0">
            {title}
          </h2>
          {description && <p className="text-xs text-ink-faint mt-0.5 mb-0">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
