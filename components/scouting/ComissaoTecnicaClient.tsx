"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ScatterPlot, type ScatterPoint } from "@/components/scouting/ScatterPlot";

export interface ScoutAthlete {
  id: string;
  full_name: string;
  team: string | null;
  category: string | null;
  attack: number;
  defense: number;
  overall: number;
  warnings: string[];
}

const ALL = "";
const PALETTE = ["#7A1F1F", "#1B3A6B", "#2E7D32", "#A9791E", "#5B4F8A", "#B4502A", "#2E6B6B"];

function median(values: number[]) {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

interface EvolutionReason {
  athlete: ScoutAthlete;
  reasons: string[];
  gap: number;
}

function buildEvolutionList(
  filtered: ScoutAthlete[],
  medianX: number,
  medianY: number,
): EvolutionReason[] {
  const list: EvolutionReason[] = [];
  for (const a of filtered) {
    const reasons: string[] = [];
    const belowAttack = a.attack < medianX;
    const belowDefense = a.defense < medianY;

    if (belowAttack && belowDefense) {
      reasons.push(
        `Abaixo da média do grupo nos dois lados — ofensivo ${a.attack} (mediana ${medianX}) e defensivo ${a.defense} (mediana ${medianY}).`,
      );
    } else if (belowAttack) {
      reasons.push(`Ofensivo abaixo da média do grupo: ${a.attack} vs. mediana ${medianX}.`);
    } else if (belowDefense) {
      reasons.push(`Defensivo abaixo da média do grupo: ${a.defense} vs. mediana ${medianY}.`);
    }

    reasons.push(...a.warnings);

    if (reasons.length > 0) {
      const gap = Math.max(medianX - a.attack, 0) + Math.max(medianY - a.defense, 0);
      list.push({ athlete: a, reasons, gap });
    }
  }
  return list.sort((a, b) => b.gap - a.gap);
}

export function ComissaoTecnicaClient({ athletes }: { athletes: ScoutAthlete[] }) {
  const [team, setTeam] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  const teams = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.team).filter(Boolean))).sort() as string[],
    [athletes],
  );
  const categories = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.category).filter(Boolean))).sort() as string[],
    [athletes],
  );
  const teamColor = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((t, i) => map.set(t, PALETTE[i % PALETTE.length]));
    return map;
  }, [teams]);

  const filtered = athletes.filter(
    (a) => (!team || a.team === team) && (!category || a.category === category),
  );

  const points: ScatterPoint[] = filtered.map((a) => ({
    id: a.id,
    x: a.attack,
    y: a.defense,
    label: a.full_name,
    subtitle: `${a.team ?? "—"} · ${a.category ?? "—"}`,
    color: a.team ? teamColor.get(a.team) ?? "#4A4536" : "#4A4536",
    href: `/athletes/${a.id}/dados`,
  }));

  const medianX = median(filtered.map((a) => a.attack));
  const medianY = median(filtered.map((a) => a.defense));
  const evolutionList = buildEvolutionList(filtered, medianX, medianY);

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          <option value={ALL}>Todos os clubes</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          <option value={ALL}>Todos os subs</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">{filtered.length} atletas no gráfico</span>
      </div>

      <ScatterPlot points={points} />

      <div className="flex items-center gap-3 flex-wrap mt-3">
        {teams
          .filter((t) => !team || t === team)
          .map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: teamColor.get(t) }}
              />
              {t}
            </span>
          ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-ink-faint mt-3">Nenhum atleta com esse filtro.</p>
      )}

      {evolutionList.length > 0 && (
        <div className="mt-6 pt-5 border-t border-line">
          <h3 className="text-sm font-bold m-0 mb-1">Atletas com pontos de evolução</h3>
          <p className="text-xs text-ink-faint m-0 mb-3">
            Abaixo da mediana do grupo filtrado em pelo menos um lado do jogo, ou com um alerta de
            desempenho detectado nos dados. Ordenado por quem está mais distante do grupo.
          </p>
          <div className="flex flex-col gap-2.5">
            {evolutionList.map(({ athlete, reasons }) => (
              <Link
                key={athlete.id}
                href={`/athletes/${athlete.id}/dados`}
                className="block border border-line rounded-md px-3.5 py-3 hover:border-pitch-dark transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <b className="text-sm">{athlete.full_name}</b>
                  <Badge tone="sky">{athlete.team ?? "—"}</Badge>
                  <Badge tone="dark">{athlete.category ?? "—"}</Badge>
                  <span className="text-[11px] text-ink-faint font-mono">
                    ATA {athlete.attack} · DEF {athlete.defense}
                  </span>
                </div>
                <ul className="m-0 pl-4 flex flex-col gap-0.5">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-[12.5px] text-ink-soft">
                      {r}
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
