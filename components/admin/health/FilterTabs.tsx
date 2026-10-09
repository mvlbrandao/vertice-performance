import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface FilterTab {
  label: string;
  href: string;
  active: boolean;
}

/**
 * Filtro por links (a URL guarda a escolha, como nas demais telas do admin):
 * funciona sem JavaScript e dá para compartilhar o endereço. Alvo de toque de
 * 44 px em ponteiro grosso, como os botões do app.
 */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "inline-flex items-center justify-center px-3.5 py-2 pointer-coarse:min-h-11 rounded-sm border text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2",
            tab.active
              ? "bg-pitch-dark text-white border-pitch-dark"
              : "bg-white text-ink-soft border-line hover:border-pitch-dark hover:text-pitch-dark",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
