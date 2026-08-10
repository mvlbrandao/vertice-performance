"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  subtitle?: string;
  color: string;
  href?: string;
}

const VIEW = { width: 640, height: 460, pad: 46 };

function scaleX(v: number) {
  return VIEW.pad + (v / 99) * (VIEW.width - VIEW.pad * 2);
}
function scaleY(v: number) {
  return VIEW.height - VIEW.pad - (v / 99) * (VIEW.height - VIEW.pad * 2);
}

/** Espalha pontos com x/y idênticos (comum quando vários atletas ainda não
 * têm dados suficientes pra diferenciar o score) em pequeno círculo ao redor
 * da posição real, pra nenhum ponto ficar escondido atrás de outro. */
function jitter<T extends { x: number; y: number }>(points: T[]) {
  const groups = new Map<string, T[]>();
  for (const p of points) {
    const key = `${p.x}:${p.y}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const result: { point: T; dx: number; dy: number }[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push({ point: group[0], dx: 0, dy: 0 });
      continue;
    }
    const radius = 8;
    group.forEach((point, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      result.push({ point, dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius });
    });
  }
  return result;
}

export function ScatterPlot({
  points,
  anonymousPoints = [],
  highlight,
  xLabel = "Ofensivo",
  yLabel = "Defensivo",
  showQuadrants = true,
}: {
  points: ScatterPoint[];
  anonymousPoints?: { x: number; y: number }[];
  highlight?: { x: number; y: number; label: string };
  xLabel?: string;
  yLabel?: string;
  showQuadrants?: boolean;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);

  const allX = [...points.map((p) => p.x), ...anonymousPoints.map((p) => p.x), highlight?.x ?? 0];
  const allY = [...points.map((p) => p.y), ...anonymousPoints.map((p) => p.y), highlight?.y ?? 0];
  const medianX = allX.length ? [...allX].sort((a, b) => a - b)[Math.floor(allX.length / 2)] : 50;
  const medianY = allY.length ? [...allY].sort((a, b) => a - b)[Math.floor(allY.length / 2)] : 50;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="w-full h-auto rounded-md border border-line bg-white"
        onMouseLeave={() => setHovered(null)}
      >
        {/* eixos */}
        <line
          x1={VIEW.pad}
          y1={VIEW.pad}
          x2={VIEW.pad}
          y2={VIEW.height - VIEW.pad}
          stroke="#D8D2C4"
          strokeWidth={1.5}
        />
        <line
          x1={VIEW.pad}
          y1={VIEW.height - VIEW.pad}
          x2={VIEW.width - VIEW.pad}
          y2={VIEW.height - VIEW.pad}
          stroke="#D8D2C4"
          strokeWidth={1.5}
        />

        {showQuadrants && (
          <>
            <line
              x1={scaleX(medianX)}
              y1={VIEW.pad}
              x2={scaleX(medianX)}
              y2={VIEW.height - VIEW.pad}
              stroke="#E4DCC8"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            <line
              x1={VIEW.pad}
              y1={scaleY(medianY)}
              x2={VIEW.width - VIEW.pad}
              y2={scaleY(medianY)}
              stroke="#E4DCC8"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            <text x={VIEW.width - VIEW.pad - 6} y={VIEW.pad + 16} textAnchor="end" fontSize={11} fill="#9A9484" fontWeight={700}>
              COMPLETO
            </text>
            <text x={VIEW.pad + 6} y={VIEW.pad + 16} fontSize={11} fill="#9A9484" fontWeight={700}>
              ESPEC. DEFENSIVO
            </text>
            <text x={VIEW.width - VIEW.pad - 6} y={VIEW.height - VIEW.pad - 10} textAnchor="end" fontSize={11} fill="#9A9484" fontWeight={700}>
              ESPEC. OFENSIVO
            </text>
            <text x={VIEW.pad + 6} y={VIEW.height - VIEW.pad - 10} fontSize={11} fill="#9A9484" fontWeight={700}>
              EM DESENVOLVIMENTO
            </text>
          </>
        )}

        <text
          x={VIEW.width / 2}
          y={VIEW.height - 8}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill="#4A4536"
        >
          {xLabel} →
        </text>
        <text
          x={14}
          y={VIEW.height / 2}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill="#4A4536"
          transform={`rotate(-90, 14, ${VIEW.height / 2})`}
        >
          {yLabel} →
        </text>

        {jitter(anonymousPoints).map(({ point: p, dx, dy }, i) => (
          <circle
            key={i}
            cx={scaleX(p.x) + dx}
            cy={scaleY(p.y) + dy}
            r={5}
            fill="#D8D2C4"
            opacity={0.7}
          />
        ))}

        {jitter(points).map(({ point: p, dx, dy }) => (
          <g
            key={p.id}
            onMouseEnter={() => setHovered(p)}
            onClick={() => p.href && router.push(p.href)}
            style={{ cursor: p.href ? "pointer" : "default" }}
          >
            <circle
              cx={scaleX(p.x) + dx}
              cy={scaleY(p.y) + dy}
              r={hovered?.id === p.id ? 9 : 7}
              fill={p.color}
              stroke="#1C1912"
              strokeWidth={1.5}
            />
          </g>
        ))}

        {highlight && (
          <g>
            <circle
              cx={scaleX(highlight.x)}
              cy={scaleY(highlight.y)}
              r={10}
              fill="#FFD600"
              stroke="#1C1912"
              strokeWidth={2}
            />
            <text
              x={scaleX(highlight.x)}
              y={scaleY(highlight.y) - 16}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#1C1912"
            >
              {highlight.label}
            </text>
          </g>
        )}
      </svg>

      {hovered && (
        <div className="absolute top-2 left-2 bg-pitch-dark text-chalk text-xs rounded-md px-3 py-2 pointer-events-none shadow-lg">
          <b className="block">{hovered.label}</b>
          {hovered.subtitle && <span className="text-white/60">{hovered.subtitle}</span>}
          <span className="block mt-0.5">
            Ofensivo {hovered.x} · Defensivo {hovered.y}
          </span>
        </div>
      )}
    </div>
  );
}
