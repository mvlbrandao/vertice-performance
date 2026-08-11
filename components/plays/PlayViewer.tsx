"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCourtSVG } from "@/components/plays/PlayCourtSVG";
import { defaultFrame, type PlayFrame, type PlaySportType } from "@/lib/types/plays";
import { frameAtProgress, SEGMENT_MS } from "@/lib/plays/animation";

const SPEEDS = [0.5, 1, 1.5] as const;

export function PlayViewer({
  frames,
  sportType = "futsal",
}: {
  frames: PlayFrame[];
  sportType?: PlaySportType;
}) {
  const safeFrames = frames.length > 0 ? frames : [defaultFrame()];
  const animatable = safeFrames.length > 1;

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const totalMs = (safeFrames.length - 1) * SEGMENT_MS;

  useEffect(() => {
    if (!playing || !animatable) return;

    function tick(now: number) {
      const last = lastTickRef.current;
      lastTickRef.current = now;
      if (last !== null) {
        const delta = ((now - last) * speed) / totalMs;
        setProgress((prev) => {
          const next = prev + delta;
          if (next >= 1) {
            setPlaying(false);
            return 1;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [playing, animatable, speed, totalMs]);

  function handlePlayPause() {
    if (progress >= 1) setProgress(0);
    setPlaying((p) => !p);
  }

  function handleRestart() {
    setProgress(0);
    setPlaying(true);
  }

  const currentFrame = animatable ? frameAtProgress(safeFrames, progress) : safeFrames[0];
  const currentStep = Math.min(
    Math.floor(progress * (safeFrames.length - 1)) + 1,
    safeFrames.length,
  );

  return (
    <div>
      <PlayCourtSVG frame={currentFrame} sportType={sportType} interactive={false} />

      {animatable && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePlayPause}
              className="inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold bg-pitch-dark text-white border-pitch-dark hover:bg-pitch-light px-3.5 py-2 text-[13px] min-h-[40px]"
              aria-label={playing ? "Pausar animação" : "Reproduzir animação"}
            >
              {playing ? "⏸ Pausar" : progress >= 1 ? "↻ Repetir" : "▶ Reproduzir"}
            </button>
            {progress > 0 && !playing && progress < 1 && (
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center justify-center rounded-sm border border-line text-ink-soft font-semibold px-3 py-2 text-[13px] min-h-[40px] hover:border-pitch-dark"
              >
                ↻ Do início
              </button>
            )}

            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => {
                setPlaying(false);
                setProgress(Number(e.target.value) / 1000);
              }}
              aria-label="Posição da animação"
              className="flex-1 min-w-[140px] accent-amber h-10"
            />

            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded-sm border font-semibold px-2.5 py-2 text-[12px] min-h-[40px] min-w-[42px] ${
                    speed === s
                      ? "bg-amber text-pitch-dark border-amber"
                      : "border-line text-ink-soft hover:border-pitch-dark"
                  }`}
                  aria-label={`Velocidade ${s}x`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11.5px] text-ink-faint">
              Passo {currentStep} de {safeFrames.length}
            </span>
            <div className="flex gap-1">
              {safeFrames.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setProgress(safeFrames.length > 1 ? i / (safeFrames.length - 1) : 0);
                  }}
                  aria-label={`Ir para o passo ${i + 1}`}
                  className={`w-6 h-6 rounded-full text-[10px] font-bold ${
                    i + 1 === currentStep
                      ? "bg-pitch-dark text-amber"
                      : "bg-line text-ink-faint hover:bg-ink-faint hover:text-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
