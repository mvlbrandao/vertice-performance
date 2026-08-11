import type { PlayFrame } from "@/lib/types/plays";

/** Duração padrão de cada transição entre quadros, em ms. */
export const SEGMENT_MS = 1500;

/** Suaviza início e fim do movimento — jogador não arranca nem para "seco". */
export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Posição intermediária entre dois quadros. Marcadores são casados por id
 * (o editor clona os ids ao criar um quadro novo), então cada jogador/bola
 * desliza da posição do quadro atual até a do próximo. Quem existe só num
 * dos dois lados aparece parado, sem sumir no meio da animação.
 */
export function interpolateFrames(from: PlayFrame, to: PlayFrame, rawT: number): PlayFrame {
  const t = easeInOutCubic(Math.min(Math.max(rawT, 0), 1));

  const moved = from.markers.map((m) => {
    const target = to.markers.find((tm) => tm.id === m.id);
    if (!target) return m;
    return { ...m, x: m.x + (target.x - m.x) * t, y: m.y + (target.y - m.y) * t };
  });

  const appearing = to.markers.filter((tm) => !from.markers.some((m) => m.id === tm.id));

  return {
    markers: [...moved, ...appearing],
    // As setas do quadro de origem descrevem o movimento que está
    // acontecendo — somem conforme ele se completa.
    arrows: t < 0.85 ? from.arrows : [],
  };
}

/** Converte progresso global (0..1) em quadro interpolado. */
export function frameAtProgress(frames: PlayFrame[], progress: number): PlayFrame {
  if (frames.length === 0) return { markers: [], arrows: [] };
  if (frames.length === 1) return frames[0];

  const segments = frames.length - 1;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const exact = clamped * segments;
  const index = Math.min(Math.floor(exact), segments - 1);
  return interpolateFrames(frames[index], frames[index + 1], exact - index);
}
