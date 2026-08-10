"use client";

import { useEffect, useRef } from "react";
import type { ScoreChangeResult } from "@/lib/scoreHistory";
import { acknowledgeScoreSnapshot } from "@/lib/actions/scoreSnapshots";

export function ScoreChangeAlert({
  result,
  warnings,
}: {
  result: ScoreChangeResult | null;
  warnings: string[];
}) {
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    if (!result || acknowledgedRef.current) return;
    acknowledgedRef.current = true;
    acknowledgeScoreSnapshot(result.snapshotId);
  }, [result]);

  if (!result) return null;
  const { change } = result;
  const isUp = change.direction === "up";

  return (
    <div
      className={`rounded-md px-3.5 py-3 mb-4 text-[13px] ${
        isUp
          ? "bg-[#E9F7EF] border border-[#9AD8B4] text-[#1A6B3C]"
          : "bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000]"
      }`}
    >
      <b className="block mb-1">
        {isUp ? "📈 Seu score subiu!" : "📉 Seu score caiu"} {change.previousOverall} →{" "}
        {change.currentOverall}
      </b>
      {change.changedAttributes.length > 0 && (
        <p className="m-0 text-[12px]">
          {change.changedAttributes.map((a) => `${a.label}: ${a.from} → ${a.to}`).join(" · ")}
        </p>
      )}
      {!isUp &&
        warnings.map((w) => (
          <p key={w} className="m-0 mt-1 text-[12px]">
            {w}
          </p>
        ))}
    </div>
  );
}
