"use client";

import { useState } from "react";
import { ScatterPlot } from "@/components/scouting/ScatterPlot";

type Scope = "category" | "club" | "system";

function PercentileBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-[80px] text-[12.5px] font-semibold text-ink-soft shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-deep to-amber"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-16 text-right font-mono text-xs text-ink-soft">percentil {value}</span>
    </div>
  );
}

export function AthleteComparisonCard({
  own,
  categoryCloud,
  clubCloud,
  systemPercentile,
  category,
}: {
  own: { attack: number; defense: number };
  categoryCloud: { x: number; y: number }[];
  clubCloud: { x: number; y: number }[];
  systemPercentile: { attackPercentile: number; defensePercentile: number; sampleSize: number } | null;
  category: string | null;
}) {
  const [scope, setScope] = useState<Scope>("category");

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {(
          [
            ["category", `Meu sub${category ? ` (${category})` : ""}`],
            ["club", "Meu clube"],
            ["system", "Sistema"],
          ] as [Scope, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              scope === key
                ? "bg-pitch-dark text-white border-pitch-dark"
                : "bg-white text-ink-soft border-line hover:border-pitch-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {scope !== "system" ? (
        <>
          <ScatterPlot
            points={[]}
            anonymousPoints={scope === "category" ? categoryCloud : clubCloud}
            highlight={{ x: own.attack, y: own.defense, label: "Você" }}
          />
          <p className="text-[11.5px] text-ink-faint mt-2">
            Os pontos cinzas são colegas {scope === "category" ? "do seu sub" : "do seu clube"} —
            sem nome, só pra você ver onde está em relação ao grupo.
          </p>
        </>
      ) : systemPercentile ? (
        <div className="pt-1">
          <PercentileBar label="Ofensivo" value={systemPercentile.attackPercentile} />
          <PercentileBar label="Defensivo" value={systemPercentile.defensePercentile} />
          <p className="text-[11.5px] text-ink-faint mt-1">
            Comparado com {systemPercentile.sampleSize} atletas do sub {category} em todo o
            sistema. Por privacidade, não mostramos atletas de outros clubes individualmente —
            só sua posição na distribuição geral.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-faint">
          Ainda não há atletas suficientes do seu sub em todo o sistema pra essa comparação.
        </p>
      )}
    </div>
  );
}
