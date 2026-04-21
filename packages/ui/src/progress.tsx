import * as React from "react";
import { cn } from "./cn";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  color?: "emerald" | "blue" | "amber" | "rose";
}

const gradientMap: Record<NonNullable<ProgressProps["color"]>, string> = {
  emerald: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
  blue:    "linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)",
  amber:   "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
  rose:    "linear-gradient(90deg, #f43f5e 0%, #ec4899 100%)",
};

const glowMap: Record<NonNullable<ProgressProps["color"]>, string> = {
  emerald: "0 0 12px -2px rgba(16, 185, 129, 0.55)",
  blue:    "0 0 12px -2px rgba(59, 130, 246, 0.55)",
  amber:   "0 0 12px -2px rgba(245, 158, 11, 0.5)",
  rose:    "0 0 12px -2px rgba(244, 63, 94, 0.55)",
};

export const Progress: React.FC<ProgressProps> = ({
  value, max = 100, color = "emerald", className, ...props
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/[0.04]",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      {...props}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${pct}%`,
          backgroundImage: gradientMap[color],
          boxShadow: glowMap[color],
        }}
      />
    </div>
  );
};
