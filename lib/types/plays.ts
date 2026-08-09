export type PlayMarkerKind = "own" | "opponent" | "ball";

export interface PlayMarker {
  id: string;
  kind: PlayMarkerKind;
  x: number;
  y: number;
  label?: string;
}

export interface PlayArrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

export interface PlayFrame {
  markers: PlayMarker[];
  arrows: PlayArrow[];
}

export const COURT_VIEWBOX = { width: 600, height: 380 };

export function defaultFrame(): PlayFrame {
  return {
    markers: [
      { id: crypto.randomUUID(), kind: "own", x: 60, y: 190, label: "1" },
      { id: crypto.randomUUID(), kind: "own", x: 220, y: 100, label: "2" },
      { id: crypto.randomUUID(), kind: "own", x: 220, y: 280, label: "3" },
      { id: crypto.randomUUID(), kind: "own", x: 360, y: 190, label: "4" },
      { id: crypto.randomUUID(), kind: "ball", x: 360, y: 190 },
    ],
    arrows: [],
  };
}
