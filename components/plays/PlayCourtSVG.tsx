"use client";

import { useRef } from "react";
import { COURT_VIEWBOX, type PlayFrame, type PlaySportType } from "@/lib/types/plays";

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

function FieldMarkings({
  sportType,
  width,
  height,
}: {
  sportType: PlaySportType;
  width: number;
  height: number;
}) {
  const mid = height / 2;

  if (sportType === "campo") {
    return (
      <g pointerEvents="none">
        <rect x={10} y={10} width={width - 20} height={height - 20} fill="none" stroke="white" strokeWidth={2} />
        <line x1={width / 2} y1={10} x2={width / 2} y2={height - 10} stroke="white" strokeWidth={2} />
        <circle cx={width / 2} cy={mid} r={50} fill="none" stroke="white" strokeWidth={2} />
        <circle cx={width / 2} cy={mid} r={2.5} fill="white" />
        {/* grande área + pequena área, esquerda e direita */}
        <rect x={10} y={mid - 110} width={90} height={220} fill="none" stroke="white" strokeWidth={2} />
        <rect x={10} y={mid - 45} width={35} height={90} fill="none" stroke="white" strokeWidth={2} />
        <rect x={width - 100} y={mid - 110} width={90} height={220} fill="none" stroke="white" strokeWidth={2} />
        <rect x={width - 45} y={mid - 45} width={35} height={90} fill="none" stroke="white" strokeWidth={2} />
        <circle cx={80} cy={mid} r={2.5} fill="white" />
        <circle cx={width - 80} cy={mid} r={2.5} fill="white" />
      </g>
    );
  }

  if (sportType === "fut7") {
    return (
      <g pointerEvents="none">
        <rect x={10} y={10} width={width - 20} height={height - 20} fill="none" stroke="white" strokeWidth={2} />
        <line x1={width / 2} y1={10} x2={width / 2} y2={height - 10} stroke="white" strokeWidth={2} />
        <circle cx={width / 2} cy={mid} r={45} fill="none" stroke="white" strokeWidth={2} />
        <circle cx={width / 2} cy={mid} r={2.5} fill="white" />
        <rect x={10} y={mid - 75} width={65} height={150} fill="none" stroke="white" strokeWidth={2} />
        <rect x={width - 75} y={mid - 75} width={65} height={150} fill="none" stroke="white" strokeWidth={2} />
        <circle cx={65} cy={mid} r={2.5} fill="white" />
        <circle cx={width - 65} cy={mid} r={2.5} fill="white" />
      </g>
    );
  }

  // futsal (padrão)
  return (
    <g pointerEvents="none">
      <rect x={10} y={10} width={width - 20} height={height - 20} fill="none" stroke="white" strokeWidth={2} />
      <line x1={width / 2} y1={10} x2={width / 2} y2={height - 10} stroke="white" strokeWidth={2} />
      <circle cx={width / 2} cy={mid} r={50} fill="none" stroke="white" strokeWidth={2} />
      <circle cx={width / 2} cy={mid} r={2.5} fill="white" />

      <path
        d={`M10,${mid - 60} A70,70 0 0,1 80,${mid} A70,70 0 0,1 10,${mid + 60}`}
        fill="none"
        stroke="white"
        strokeWidth={2}
      />
      <path
        d={`M${width - 10},${mid - 60} A70,70 0 0,0 ${width - 80},${mid} A70,70 0 0,0 ${width - 10},${mid + 60}`}
        fill="none"
        stroke="white"
        strokeWidth={2}
      />
      <rect x={2} y={mid - 20} width={8} height={40} fill="white" />
      <rect x={width - 10} y={mid - 20} width={8} height={40} fill="white" />
      <circle cx={55} cy={mid} r={2.5} fill="white" />
      <circle cx={width - 55} cy={mid} r={2.5} fill="white" />
    </g>
  );
}

export function PlayCourtSVG({
  frame,
  sportType = "futsal",
  interactive = false,
  selectedId = null,
  previewArrow = null,
  onMarkerPointerDown,
  onCanvasPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  frame: PlayFrame;
  sportType?: PlaySportType;
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
      {/* quadra/campo (não intercepta pointer events, pra clique/drag no fundo funcionar) */}
      <FieldMarkings sportType={sportType} width={width} height={height} />

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
