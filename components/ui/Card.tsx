import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  shadow,
  ...props
}: HTMLAttributes<HTMLDivElement> & { shadow?: boolean }) {
  return (
    <div
      className={cn(
        "bg-paper border border-line rounded-lg p-5",
        shadow && "shadow-card",
        className,
      )}
      {...props}
    />
  );
}
