"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AlternativesResponse, Exercise } from "@/lib/types";
import { AddToWorkoutSheet } from "@/components/add-to-workout-sheet";

const LEVEL_TINT: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  intermediate: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  advanced: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

function typeTag(ex: Exercise): string {
  if (ex.isBodyweight) return "Bodyweight";
  if (ex.isMachine) return "Machine";
  if (ex.isCable) return "Cable";
  if (ex.isBands) return "Bands";
  if (ex.isFreeWeight) return "Free Weight";
  return ex.equipment[0] ?? "Other";
}

export default function ExerciseDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [ex, setEx] = useState<Exercise | null>(null);
  const [alts, setAlts] = useState<AlternativesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<{ exercise: Exercise }>(`/exercises/${slug}`),
      api
        .get<AlternativesResponse>(`/exercises/${slug}/alternatives`)
        .catch(() => null),
    ])
      .then(([d, a]) => {
        setEx(d.exercise);
        setAlts(a);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl animate-pulse flex-col gap-4">
        <div className="h-8 w-2/3 rounded bg-white/5" />
        <div className="h-4 w-1/3 rounded bg-white/5" />
        <div className="mt-4 h-32 w-full rounded-2xl bg-white/5" />
        <div className="h-48 w-full rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (error || !ex) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-300">
        {error === "exercise_not_found" ? "Exercise not found." : "Something went wrong."}
        <div className="mt-3">
          <Link href="/exercises" className="text-rose-200 underline underline-offset-4">
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  const levelCls = LEVEL_TINT[ex.level] ?? "bg-white/10 text-zinc-300 border-white/15";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-24 sm:pb-10">
      <Link
        href="/exercises"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to library
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${levelCls}`}
          >
            {ex.level}
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] capitalize text-zinc-300">
            {ex.bodyPart}
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] capitalize text-zinc-300">
            {typeTag(ex)}
          </span>
          {ex.mechanic && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] capitalize text-zinc-400">
              {ex.mechanic}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {ex.name}
        </h1>
        {ex.equipment.length > 0 && (
          <p className="text-sm text-zinc-400">
            Equipment: <span className="capitalize text-zinc-200">{ex.equipment.join(", ")}</span>
          </p>
        )}
      </header>

      {/* Muscles */}
      <section className="glass rounded-2xl border border-white/[0.08] p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Muscles worked
        </h2>
        <div className="flex flex-wrap gap-2">
          {ex.primaryMuscles.map((m) => (
            <span
              key={m}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium capitalize text-emerald-200"
            >
              {m}
            </span>
          ))}
          {ex.secondaryMuscles.map((m) => (
            <span
              key={m}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs capitalize text-zinc-300"
            >
              {m}
            </span>
          ))}
          {ex.primaryMuscles.length + ex.secondaryMuscles.length === 0 && (
            <span className="text-xs text-zinc-500">No muscle data available.</span>
          )}
        </div>
      </section>

      {/* Instructions */}
      <section className="glass rounded-2xl border border-white/[0.08] p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Step-by-step
        </h2>
        {ex.instructions.length > 0 ? (
          <ol className="space-y-3">
            {ex.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-zinc-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">
            No instructions available for this exercise.
          </p>
        )}
      </section>

      {/* Tips */}
      {ex.tips.length > 0 && (
        <section className="glass rounded-2xl border border-white/[0.08] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Tips
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-200">
            {ex.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Alternatives */}
      {alts && alts.groups.length > 0 && (
        <section className="glass rounded-2xl border border-white/[0.08] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Alternatives (same body part)
          </h2>
          <div className="flex flex-col gap-4">
            {alts.groups.slice(0, 6).map((g) => (
              <div key={g.equipment} className="flex flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  {g.equipment}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.exercises.map((alt) => (
                    <Link
                      key={alt.id}
                      href={`/exercises/${alt.slug}`}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      {alt.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Desktop Add-to-Workout */}
      <div className="hidden sm:flex">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow-brand transition-transform hover:-translate-y-0.5"
        >
          Add to workout
        </button>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-ink-900/80 p-3 backdrop-blur-xl sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow-brand"
        >
          Add to workout
        </button>
      </div>

      <AddToWorkoutSheet
        exercise={ex}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
