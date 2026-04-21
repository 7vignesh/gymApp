"use client";

import Link from "next/link";
import type { Exercise } from "@/lib/types";

function typeTag(ex: Exercise): string {
  if (ex.isBodyweight) return "Bodyweight";
  if (ex.isMachine) return "Machine";
  if (ex.isCable) return "Cable";
  if (ex.isBands) return "Bands";
  if (ex.isFreeWeight) return "Free Weight";
  return ex.equipment[0] ?? "Other";
}

const LEVEL_TINT: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  intermediate: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  advanced: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const firstInstruction = exercise.instructions?.[0] ?? "";
  const levelCls = LEVEL_TINT[exercise.level] ?? "bg-white/10 text-zinc-300 border-white/15";
  return (
    <Link
      href={`/exercises/${exercise.slug}`}
      className="group relative flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-base font-semibold text-white">
          {exercise.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${levelCls}`}
        >
          {exercise.level}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 capitalize text-zinc-300">
          {exercise.bodyPart}
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 capitalize text-zinc-300">
          {typeTag(exercise)}
        </span>
        {exercise.equipment[0] && exercise.equipment[0] !== "bodyweight" && (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 capitalize text-zinc-400">
            {exercise.equipment[0]}
          </span>
        )}
      </div>

      {firstInstruction && (
        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
          {firstInstruction}
        </p>
      )}

      <span
        aria-hidden
        className="absolute bottom-3 right-3 text-zinc-600 transition-colors group-hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

export function ExerciseCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 h-5 w-3/4 rounded bg-white/5" />
      <div className="mb-4 flex gap-1.5">
        <div className="h-4 w-12 rounded-full bg-white/5" />
        <div className="h-4 w-16 rounded-full bg-white/5" />
      </div>
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="mt-1 h-3 w-5/6 rounded bg-white/5" />
    </div>
  );
}
