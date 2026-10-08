"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ScrollableTabs } from "@/components/ui/ScrollableTabs";

/**
 * Réplica das abas do coach, sem "Dados & histórico" (edição cadastral) e
 * sem "Financeiro" (nunca aparece pra staff). Cada aba só renderiza se a
 * área correspondente estiver liberada — quem só tem "saude" não vê Treino.
 */
export function StaffAthleteTabs({
  athleteId,
  areas,
}: {
  athleteId: string;
  areas: string[];
}) {
  const pathname = usePathname();
  const base = `/meus-atletas/${athleteId}`;
  const tabs = [
    { href: `${base}/evolucao`, label: "Linha do tempo", show: true },
    { href: `${base}/treino`, label: "Treinos", show: areas.includes("treino") },
    { href: `${base}/checkin`, label: "Check-ins", show: areas.includes("saude") },
    { href: `${base}/anamnese`, label: "Anamnese", show: areas.includes("anamnese") },
    { href: `${base}/lesoes`, label: "Lesões", show: areas.includes("saude") },
    { href: `${base}/relatorio`, label: "📄 Relatório", show: true },
  ].filter((t) => t.show);

  return (
    <ScrollableTabs
      role="navigation"
      label="Seções do atleta"
      activeKey={pathname}
      className="gap-0.5 border-b-2 border-line mb-5"
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-4 py-2.5 pointer-coarse:py-3.5 text-[13.5px] font-semibold whitespace-nowrap -mb-0.5 border-b-[3px]",
              active ? "text-ink border-amber" : "text-ink-faint border-transparent hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </ScrollableTabs>
  );
}
