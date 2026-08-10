"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function AthleteTabs({ athleteId }: { athleteId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/athletes/${athleteId}/dados`, label: "Dados & histórico" },
    { href: `/athletes/${athleteId}/evolucao`, label: "Linha do tempo" },
    { href: `/athletes/${athleteId}/treino`, label: "Treinos" },
    { href: `/athletes/${athleteId}/checkin`, label: "Check-ins" },
    { href: `/athletes/${athleteId}/anamnese`, label: "Anamnese" },
    { href: `/athletes/${athleteId}/lesoes`, label: "Lesões" },
    { href: `/athletes/${athleteId}/financeiro`, label: "Financeiro" },
  ];

  return (
    <div className="flex gap-0.5 border-b-2 border-line mb-5 overflow-x-auto">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-0.5 border-b-[3px]",
              active ? "text-ink border-amber" : "text-ink-faint border-transparent hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
