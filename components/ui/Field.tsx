import { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "px-3 py-2.5 border border-line rounded-sm bg-white text-sm focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber",
        className,
      )}
      {...props}
    />
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="text-xs font-semibold text-ink-soft uppercase tracking-wide"
      {...props}
    />
  );
}
