"use client";

import { useState } from "react";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/types";

const LABELS: Record<MuscleGroup, string> = {
  biceps: "Biceps",
  triceps: "Triceps",
  back: "Back",
  chest: "Chest",
  shoulders: "Shoulders",
  legs: "Legs",
  core: "Core",
  forearms: "Forearms",
  "full body": "Full Body",
};

// Minimal inline SVGs so we don't pull a new dep.
const Icon = ({
  group,
  className = "h-6 w-6",
}: {
  group: MuscleGroup;
  className?: string;
}) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (group) {
    case "biceps":
      return (
        <svg {...common}>
          <path d="M5 14c3-4 6-4 9-1 2 2 4 2 5 1" />
          <path d="M6 15c1 3 3 4 6 4s5-2 5-4" />
        </svg>
      );
    case "triceps":
      return (
        <svg {...common}>
          <path d="M19 14c-3-4-6-4-9-1-2 2-4 2-5 1" />
          <path d="M18 15c-1 3-3 4-6 4s-5-2-5-4" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <path d="M6 4h12l-2 6-4 10-4-10z" />
          <path d="M8 10h8" />
        </svg>
      );
    case "chest":
      return (
        <svg {...common}>
          <path d="M3 7c3-2 6-2 9 1 3-3 6-3 9-1-1 6-4 9-9 9S4 13 3 7Z" />
          <path d="M12 8v8" />
        </svg>
      );
    case "shoulders":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
        </svg>
      );
    case "legs":
      return (
        <svg {...common}>
          <path d="M9 3h6l-1 8-2 10" />
          <path d="M15 3l-1 8 2 10" />
        </svg>
      );
    case "core":
      return (
        <svg {...common}>
          <rect x="8" y="4" width="8" height="16" rx="2" />
          <path d="M8 9h8M8 14h8" />
        </svg>
      );
    case "forearms":
      return (
        <svg {...common}>
          <path d="M4 8c4 0 8 3 12 3s4-3 4-3" />
          <path d="M4 16c4 0 8-3 12-3s4 3 4 3" />
        </svg>
      );
    case "full body":
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.5" />
          <path d="M7 11h10l-2 5v5M12 16v5M9 21h6" />
        </svg>
      );
  }
};

export interface MuscleGroupSelectorProps {
  value?: MuscleGroup[];
  onChange?: (next: MuscleGroup[]) => void;
  onSave?: (next: MuscleGroup[]) => void | Promise<void>;
  onSkip?: () => void;
  saving?: boolean;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  showSkip?: boolean;
}

export function MuscleGroupSelector({
  value,
  onChange,
  onSave,
  onSkip,
  saving = false,
  title = "Pick your focus",
  subtitle = "We'll tailor the exercise library to the muscles you want to train.",
  ctaLabel = "Let's Go",
  showSkip = true,
}: MuscleGroupSelectorProps) {
  const [internal, setInternal] = useState<MuscleGroup[]>(value ?? []);
  const selected = value ?? internal;

  const toggle = (g: MuscleGroup) => {
    const next = selected.includes(g)
      ? selected.filter((x) => x !== g)
      : [...selected, g];
    if (onChange) onChange(next);
    else setInternal(next);
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(selected);
  };

  return (
    <div className="glass rounded-3xl border border-white/[0.08] p-6 sm:p-8">
      <div className="mb-6 text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      <div
        role="group"
        aria-label="Muscle groups"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {MUSCLE_GROUPS.map((g) => {
          const active = selected.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              aria-pressed={active}
              className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition-all ${
                active
                  ? "border-transparent bg-brand-gradient text-white shadow-glow-brand"
                  : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon group={g} className="h-7 w-7" />
              <span className="font-medium capitalize">{LABELS[g]}</span>
              {active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/20 p-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {selected.length
            ? `${selected.length} group${selected.length > 1 ? "s" : ""} selected`
            : "Pick at least one to get a curated list."}
        </p>
        <div className="flex gap-3">
          {showSkip && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            className="rounded-xl bg-brand-gradient px-5 py-2 text-sm font-medium text-white shadow-glow-brand transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {saving ? "Saving…" : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
