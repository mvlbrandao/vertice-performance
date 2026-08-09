export type PlayMarkerKind = "own" | "opponent" | "ball";
export type PlaySportType = "futsal" | "campo" | "fut7";

export const SPORT_LABELS: Record<PlaySportType, string> = {
  futsal: "Futsal",
  campo: "Campo (11)",
  fut7: "Fut7",
};

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

// Presets de posicionamento (coordenadas dentro de COURT_VIEWBOX) por
// esporte e formação. O primeiro ponto de cada formação é sempre o goleiro.
export const FORMATIONS: Record<PlaySportType, Record<string, { x: number; y: number }[]>> = {
  futsal: {
    "1-2-1": [
      { x: 40, y: 190 },
      { x: 160, y: 190 },
      { x: 300, y: 100 },
      { x: 300, y: 280 },
      { x: 440, y: 190 },
    ],
    "2-2": [
      { x: 40, y: 190 },
      { x: 160, y: 120 },
      { x: 160, y: 260 },
      { x: 340, y: 120 },
      { x: 340, y: 260 },
    ],
    "3-1": [
      { x: 40, y: 190 },
      { x: 160, y: 90 },
      { x: 160, y: 190 },
      { x: 160, y: 290 },
      { x: 420, y: 190 },
    ],
    Quadrado: [
      { x: 40, y: 190 },
      { x: 220, y: 110 },
      { x: 220, y: 270 },
      { x: 380, y: 110 },
      { x: 380, y: 270 },
    ],
  },
  campo: {
    "4-4-2": [
      { x: 30, y: 190 },
      { x: 110, y: 60 },
      { x: 110, y: 150 },
      { x: 110, y: 230 },
      { x: 110, y: 320 },
      { x: 280, y: 60 },
      { x: 280, y: 150 },
      { x: 280, y: 230 },
      { x: 280, y: 320 },
      { x: 460, y: 140 },
      { x: 460, y: 240 },
    ],
    "4-3-3": [
      { x: 30, y: 190 },
      { x: 110, y: 60 },
      { x: 110, y: 150 },
      { x: 110, y: 230 },
      { x: 110, y: 320 },
      { x: 260, y: 110 },
      { x: 260, y: 190 },
      { x: 260, y: 270 },
      { x: 440, y: 80 },
      { x: 460, y: 190 },
      { x: 440, y: 300 },
    ],
    "3-5-2": [
      { x: 30, y: 190 },
      { x: 130, y: 100 },
      { x: 130, y: 190 },
      { x: 130, y: 280 },
      { x: 270, y: 50 },
      { x: 270, y: 150 },
      { x: 270, y: 190 },
      { x: 270, y: 230 },
      { x: 270, y: 330 },
      { x: 460, y: 150 },
      { x: 460, y: 230 },
    ],
    "4-2-3-1": [
      { x: 30, y: 190 },
      { x: 110, y: 60 },
      { x: 110, y: 150 },
      { x: 110, y: 230 },
      { x: 110, y: 320 },
      { x: 220, y: 140 },
      { x: 220, y: 240 },
      { x: 370, y: 70 },
      { x: 370, y: 190 },
      { x: 370, y: 310 },
      { x: 480, y: 190 },
    ],
  },
  fut7: {
    "2-3-1": [
      { x: 35, y: 190 },
      { x: 150, y: 120 },
      { x: 150, y: 260 },
      { x: 300, y: 60 },
      { x: 300, y: 190 },
      { x: 300, y: 320 },
      { x: 460, y: 190 },
    ],
    "3-2-1": [
      { x: 35, y: 190 },
      { x: 150, y: 80 },
      { x: 150, y: 190 },
      { x: 150, y: 300 },
      { x: 300, y: 130 },
      { x: 300, y: 250 },
      { x: 460, y: 190 },
    ],
    "1-3-2": [
      { x: 35, y: 190 },
      { x: 150, y: 190 },
      { x: 300, y: 60 },
      { x: 300, y: 190 },
      { x: 300, y: 320 },
      { x: 460, y: 130 },
      { x: 460, y: 250 },
    ],
  },
};
