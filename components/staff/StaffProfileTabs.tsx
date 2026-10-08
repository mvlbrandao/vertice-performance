"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ScrollableTabs } from "@/components/ui/ScrollableTabs";

const TABS = [
  { id: "dados", label: "Dados" },
  { id: "recebimentos", label: "Recebimentos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function StaffProfileTabs({
  dados,
  recebimentos,
}: {
  dados: ReactNode;
  recebimentos: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("dados");

  return (
    <div>
      <ScrollableTabs
        role="tablist"
        label="Seções do perfil"
        activeKey={tab}
        className="gap-1 border-b border-line mb-4"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3.5 py-2.5 pointer-coarse:py-3.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2 -mb-px",
              tab === t.id ? "border-pitch-dark text-pitch-dark" : "border-transparent text-ink-faint",
            )}
          >
            {t.label}
          </button>
        ))}
      </ScrollableTabs>
      {tab === "dados" ? dados : recebimentos}
    </div>
  );
}
