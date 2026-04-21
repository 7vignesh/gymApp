import * as React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "relative inline-flex items-center justify-center gap-2 font-medium select-none " +
  "transition-all duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0 " +
  "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 " +
  "overflow-hidden";

const variantStyles: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,#10b981_0%,#06b6d4_100%)] " +
    "shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:shadow-[0_14px_36px_-10px_rgba(16,185,129,0.75)] " +
    "hover:brightness-110",
  secondary:
    "text-zinc-100 bg-white/5 border border-white/10 backdrop-blur " +
    "hover:bg-white/10 hover:border-white/20",
  ghost:
    "text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white",
  danger:
    "text-white bg-[linear-gradient(135deg,#f43f5e_0%,#f97316_100%)] " +
    "shadow-[0_8px_24px_-8px_rgba(244,63,94,0.6)] hover:brightness-110",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-2xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {variant === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
          style={{
            background:
              "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
          }}
        />
      )}
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  ),
);
Button.displayName = "Button";
