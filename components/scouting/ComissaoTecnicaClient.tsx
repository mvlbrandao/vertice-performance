"use client";

import { useMemo, useState } from "react";
import { ScatterPlot, type ScatterPoint } from "@/components/scouting/ScatterPlot";

export interface ScoutAthlete {
  id: string;
  full_name: string;
  team: string | null;
  category: string | null;
  attack: number;
  defense: number;
  overall: number;
}

const ALL = "";
const PALETTE = ["#7A1F1F", "#1B3A6B", "#2E7D32", "#A9791E", "#5B4F8A", "#B4502A", "#2E6B6B"];

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
    </div>
  );
}
