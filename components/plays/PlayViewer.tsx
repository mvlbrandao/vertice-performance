"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PlayCourtSVG } from "@/components/plays/PlayCourtSVG";
import { defaultFrame, type PlayFrame, type PlaySportType } from "@/lib/types/plays";

export function PlayViewer({
  frames,
  sportType = "futsal",
}: {
  frames: PlayFrame[];
  sportType?: PlaySportType;
}) {
  const safeFrames = frames.length > 0 ? frames : [defaultFrame()];
  const [index, setIndex] = useState(0);

  return (
    <div>
      <PlayCourtSVG frame={safeFrames[index]} sportType={sportType} interactive={false} />
      {safeFrames.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            ← Anterior
          </Button>
          <span className="text-xs text-ink-faint font-mono">
            {index + 1} / {safeFrames.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === safeFrames.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Próximo →
          </Button>
        </div>
      )}
    </div>
  );
}
