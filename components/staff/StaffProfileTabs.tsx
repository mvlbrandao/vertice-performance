"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function StaffProfileTabs({
  dados,
  recebimentos,
}: {
  dados: ReactNode;
  recebimentos: ReactNode;
}) {
  const [tab, setTab] = useState<"dados" | "recebimentos">("dados");

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-4">
        <button
          type="button"
          onClick={() => setTab("dados")}
          className={cn(
            "px-3.5 py-2.5 text-[13.5px] font-semibold border-b-2 -mb-px",
            tab === "dados" ? "border-pitch-dark text-pitch-dark" : "border-transparent text-ink-faint",
          )}
        >
          Dados
        </button>
        <button
          type="button"
          onClick={() => setTab("recebimentos")}
          className={cn(
            "px-3.5 py-2.5 text-[13.5px] font-semibold border-b-2 -mb-px",
            tab === "recebimentos"
              ? "border-pitch-dark text-pitch-dark"
              : "border-transparent text-ink-faint",
          )}
        >
          Recebimentos
        </button>
      </div>
      {tab === "dados" ? dados : recebimentos}
    </div>
  );
}
