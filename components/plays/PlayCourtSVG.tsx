"use client";

import { useRef } from "react";
import { COURT_VIEWBOX, type PlayFrame } from "@/lib/types/plays";

const MARKER_RADIUS = 14;
const BALL_RADIUS = 7;

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export interface SvgPoint {
  x: number;
  y: number;
}

export function PlayCourtSVG({
  frame,
  interactive = false,
  selectedId = null,
  previewArrow = null,
  onMarkerPointerDown,
  onCanvasPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  frame: PlayFrame;
  interactive?: boolean;
  selectedId?: string | null;
  previewArrow?: { x1: number; y1: number; x2: number; y2: number } | null;
  onMarkerPointerDown?: (markerId: string, point: SvgPoint) => void;
  onCanvasPointerDown?: (point: SvgPoint) => void;
  onPointerMove?: (point: SvgPoint) => void;
  onPointerUp?: (point: SvgPoint) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { width, height } = COURT_VIEWBOX;

  function handlePointer(e: React.PointerEvent, cb?: (p: SvgPoint) => void) {
    if (!svgRef.current || !cb) return;
    cb(toSvgPoint(svgRef.current, e.clientX, e.clientY));
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto rounded-md border border-line touch-none select-none"
      style={{ background: "#0F5132" }}
      onPointerDown={(e) => {
        if (e.target === svgRef.current) handlePointer(e, onCanvasPointerDown);
      }}
      onPointerMove={(e) => handlePointer(e, onPointerMove)}
      onPointerUp={(e) => handlePointer(e, onPointerUp)}
    >
      {/* quadra (não intercepta pointer events, pra clique/drag no fundo funcionar) */}
      <g pointerEvents="none">
        <rect
          x={10}
          y={10}
          width={width - 20}
          height={height - 20}
          fill="none"
          stroke="white"
          strokeWidth={2}
        />
        <line
          x1={width / 2}
          y1={10}
          x2={width / 2}
          y2={height - 10}
          stroke="white"
          strokeWidth={2}
        />
        <circle cx={width / 2} cy={height / 2} r={50} fill="none" stroke="white" strokeWidth={2} />
        <circle cx={width / 2} cy={height / 2} r={2.5} fill="white" />

        <path
          d={`M10,${height / 2 - 60} A70,70 0 0,1 80,${height / 2} A70,70 0 0,1 10,${height / 2 + 60}`}
          fill="none"
          stroke="white"
          strokeWidth={2}
        />
        <path
          d={`M${width - 10},${height / 2 - 60} A70,70 0 0,0 ${width - 80},${height / 2} A70,70 0 0,0 ${width - 10},${height / 2 + 60}`}
          fill="none"
          stroke="white"
          strokeWidth={2}
        />
        <rect x={2} y={height / 2 - 20} width={8} height={40} fill="white" />
        <rect x={width - 10} y={height / 2 - 20} width={8} height={40} fill="white" />
        <circle cx={55} cy={height / 2} r={2.5} fill="white" />
        <circle cx={width - 55} cy={height / 2} r={2.5} fill="white" />
      </g>

      <defs>
        <marker
          id="play-arrowhead"
          markerWidth={8}
          markerHeight={8}
          refX={6}
          refY={4}
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#FFD600" />
        </marker>
      </defs>

      {frame.arrows.map((a) => (
        <line
          key={a.id}
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke="#FFD600"
          strokeWidth={3}
          strokeDasharray={a.dashed ? "8 6" : undefined}
          markerEnd="url(#play-arrowhead)"
          style={interactive ? { cursor: "pointer" } : undefined}
          onPointerDown={
            interactive && onMarkerPointerDown
              ? (e) => {
                  e.stopPropagation();
                  handlePointer(e, (p) => onMarkerPointerDown(a.id, p));
                }
              : undefined
          }
          opacity={selectedId === a.id ? 0.6 : 1}
        />
      ))}

      {previewArrow && (
        <line
          x1={previewArrow.x1}
          y1={previewArrow.y1}
          x2={previewArrow.x2}
          y2={previewArrow.y2}
          stroke="#FFD600"
          strokeWidth={3}
          strokeDasharray="4 4"
          markerEnd="url(#play-arrowhead)"
        />
      )}

      {frame.markers.map((m) => {
        const isBall = m.kind === "ball";
        const r = isBall ? BALL_RADIUS : MARKER_RADIUS;
        return (
          <g
            key={m.id}
            style={interactive ? { cursor: "grab" } : undefined}
            onPointerDown={
              interactive
                ? (e) => {
                    e.stopPropagation();
                    handlePointer(e, (p) => onMarkerPointerDown?.(m.id, p));
                  }
                : undefined
            }
          >
            <circle
              cx={m.x}
              cy={m.y}
              r={r}
              fill={isBall ? "white" : m.kind === "own" ? "#FFD600" : "#F5F5F5"}
              stroke={selectedId === m.id ? "#C0392B" : m.kind === "opponent" ? "#111111" : "none"}
              strokeWidth={selectedId === m.id ? 3 : 2}
            />
            {!isBall && m.label && (
              <text
                x={m.x}
                y={m.y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#111111"
              >
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
