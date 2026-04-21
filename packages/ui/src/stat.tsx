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
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
    <span className="text-2xl font-semibold tabular-nums text-zinc-50">
      {value}
      {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
    </span>
    {hint && <span className="text-xs text-zinc-500">{hint}</span>}
  </div>
);
