import * as React from "react";
import { cn } from "./cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-50 outline-none",
            "placeholder:text-zinc-500",
            "transition-all duration-200",
            "hover:border-white/20 hover:bg-white/[0.06]",
            "focus:border-emerald-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-emerald-400/25",
            className,
          )}
          {...props}
        />
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
