"use client";

import { useState } from "react";

export interface ScoreSnapshotPoint {
  date: string;
  overall: number;
  attack: number;
  defense: number;
  physical: number;
  mental: number;
  discipline: number;
  commitment: number;
  development: number;
}

type DimKey = keyof Omit<ScoreSnapshotPoint, "date">;

const DIMENSIONS: { key: DimKey; label: string; color: string }[] = [
  { key: "overall", label: "Geral", color: "#111111" },
  { key: "attack", label: "Ataque", color: "#C0392B" },
  { key: "defense", label: "Defesa", color: "#1B3A6B" },
  { key: "physical", label: "Físico", color: "#2E7D32" },
  { key: "mental", label: "Mental", color: "#7A4FA3" },
  { key: "discipline", label: "Disciplina", color: "#B4502A" },
  { key: "commitment", label: "Compromisso", color: "#0F7B7B" },
  { key: "development", label: "Desenvolvimento", color: "#A9791E" },
];

const VIEW = { w: 640, h: 260, padL: 34, padR: 12, padT: 14, padB: 30 };

export function ScoreHistoryChart({ points }: { points: ScoreSnapshotPoint[] }) {
  const [active, setActive] = useState<DimKey[]>(["overall"]);

  if (points.length < 2) {
    return (
      <p className="text-[12.5px] text-ink-faint m-0">
        O gráfico aparece assim que houver pelo menos duas medições do score. Ele é registrado
        automaticamente sempre que o score muda.
      </p>
    );
  }

  function toggle(key: DimKey) {
    setActive((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const innerW = VIEW.w - VIEW.padL - VIEW.padR;
  const innerH = VIEW.h - VIEW.padT - VIEW.padB;
  const x = (i: number) => VIEW.padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => VIEW.padT + innerH - (v / 99) * innerH;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {DIMENSIONS.map((d) => {
          const on = active.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => toggle(d.key)}
              className={`text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                on ? "text-white" : "text-ink-soft bg-white hover:border-pitch-dark"
              }`}
              style={on ? { background: d.color, borderColor: d.color } : { borderColor: "#E4DCC8" }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="w-full h-auto rounded-md border border-line bg-white"
      >
        {[0, 25, 50, 75, 99].map((v) => (
          <g key={v}>
            <line
              x1={VIEW.padL}
              y1={y(v)}
              x2={VIEW.w - VIEW.padR}
              y2={y(v)}
              stroke="#EFEAD9"
              strokeWidth={1}
            />
            <text x={VIEW.padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize={9} fill="#9A9484">
              {v}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || points.length <= 6 ? (
            <text
              key={p.date + i}
              x={x(i)}
              y={VIEW.h - 10}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize={9}
              fill="#9A9484"
            >
              {p.date.slice(5)}
            </text>
          ) : null,
        )}

        {DIMENSIONS.filter((d) => active.includes(d.key)).map((d) => {
          const path = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[d.key])}`)
            .join(" ");
          return (
            <g key={d.key}>
              <path d={path} fill="none" stroke={d.color} strokeWidth={2.5} strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p[d.key])} r={3} fill={d.color} />
              ))}
            </g>
          );
        })}
      </svg>

      {active.length === 0 && (
        <p className="text-[11.5px] text-ink-faint mt-2 mb-0">
          Escolha ao menos uma dimensão acima pra ver a curva.
        </p>
      )}
    </div>
  );
}
