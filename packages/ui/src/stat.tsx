import * as React from "react";
import { cn } from "./cn";

export interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, unit, hint, className }) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
    <span className="text-2xl font-semibold text-zinc-900 dark:text-white">
      {value}
      {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
    </span>
    {hint && <span className="text-xs text-zinc-500">{hint}</span>}
  </div>
);
