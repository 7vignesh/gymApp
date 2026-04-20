import * as React from "react";
import { cn } from "./cn";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  color?: "emerald" | "blue" | "amber" | "rose";
}

const colorMap: Record<NonNullable<ProgressProps["color"]>, string> = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

export const Progress: React.FC<ProgressProps> = ({
  value, max = 100, color = "emerald", className, ...props
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", colorMap[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
