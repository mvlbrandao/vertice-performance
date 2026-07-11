import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "green" | "amber" | "clay" | "sky" | "dark";

const toneClasses: Record<Tone, string> = {
  green: "bg-pitch-dark text-amber",
  amber: "bg-[#FFF8CC] text-[#9A7A00]",
  clay: "bg-[#FDE8E8] text-clay",
  sky: "bg-[#FDE8E8] text-sky",
  dark: "bg-pitch-dark text-chalk",
};

export function Badge({
  tone = "dark",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
