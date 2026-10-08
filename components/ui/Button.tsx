import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "solid" | "amber" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  solid: "bg-pitch-dark text-white border-pitch-dark hover:bg-pitch-light",
  amber: "bg-amber text-pitch-dark border-amber font-bold hover:bg-amber-deep",
  outline: "bg-white text-ink border-line hover:border-pitch-dark hover:text-pitch-dark",
  ghost: "bg-transparent text-ink-soft border-transparent hover:text-pitch-dark",
  danger: "bg-white text-clay border-[#F5C6C6] hover:bg-[#FDE8E8]",
};

// pointer-coarse (toque) e não breakpoint: o botão "sm" tem ~28px de altura,
// confortável com mouse mas abaixo dos ~44px que o dedo acerta sem errar. Em
// tablet grande o toque também vale, e no celular com mouse (raro) não. Em
// desktop o botão continua do tamanho de antes.
const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs pointer-coarse:min-h-11 pointer-coarse:px-3.5",
  md: "px-3.5 py-2.5 text-sm pointer-coarse:min-h-11",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
