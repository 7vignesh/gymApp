"use client";
import { useEffect, useState } from "react";

interface Props {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
}

export function CalorieRing({ value, goal, size = 180, stroke = 14 }: Props) {
  const pct = Math.min(1, Math.max(0, goal > 0 ? value / goal : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - pct);

  // Animate the dash offset from full → target on mount + when pct changes.
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const remaining = Math.max(0, Math.round(goal - value));
  const over = value > goal;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* glow halo */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.25), transparent 70%)",
        }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="calorie-ring-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#calorie-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.7, 0.2, 1)",
            filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.45))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {over ? "Over" : "Consumed"}
        </span>
        <span className="mt-1 text-4xl font-bold tabular-nums text-white">
          {Math.round(value)}
        </span>
        <span className="text-xs text-zinc-400">
          {over ? `+${Math.round(value - goal)}` : `${remaining}`} kcal{" "}
          {over ? "over" : "left"}
        </span>
      </div>
    </div>
  );
}
