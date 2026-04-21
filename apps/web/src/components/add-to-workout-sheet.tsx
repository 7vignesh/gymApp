"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Exercise, Workout } from "@/lib/types";

interface Props {
  exercise: Exercise;
  open: boolean;
  onClose: () => void;
  onAdded?: (workout: Workout) => void;
}

/** Smart defaults by difficulty (spec). */
function defaultsForLevel(level: string) {
  switch (level) {
    case "advanced":
      return { sets: 5, reps: 5, restSec: 120 };
    case "intermediate":
      return { sets: 4, reps: 8, restSec: 90 };
    default:
      return { sets: 3, reps: 12, restSec: 60 };
  }
}

export function AddToWorkoutSheet({ exercise, open, onClose, onAdded }: Props) {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("new");

  const defaults = useMemo(() => defaultsForLevel(exercise.level), [exercise.level]);
  const [sets, setSets] = useState(defaults.sets);
  const [reps, setReps] = useState(defaults.reps);
  const [weightKg, setWeightKg] = useState<string>("");
  const [restSec, setRestSec] = useState(defaults.restSec);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api
      .get<{ workouts: Workout[] }>("/workouts")
      .then((r) => {
        setWorkouts(r.workouts);
        const first = r.workouts[0];
        if (first) {
          setMode("existing");
          setSelectedId(first.id);
        } else {
          setMode("new");
          const bp = exercise.bodyPart;
          const nice = bp ? bp[0]!.toUpperCase() + bp.slice(1) : "New";
          setNewName(`${nice} day`);
        }
      })
      .catch(() => setWorkouts([]));
  }, [open, exercise.bodyPart]);

  // Reset difficulty-based defaults when exercise changes.
  useEffect(() => {
    const d = defaultsForLevel(exercise.level);
    setSets(d.sets);
    setReps(d.reps);
    setRestSec(d.restSec);
  }, [exercise.level]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let workoutId = selectedId;
      if (mode === "new") {
        const name = newName.trim() || `${exercise.bodyPart} day`;
        const { workout } = await api.post<{ workout: Workout }>("/workouts", { name });
        workoutId = workout.id;
      }
      if (!workoutId) throw new Error("no_workout");
      const weightNum = weightKg.trim() ? Number(weightKg) : null;
      await api.post(`/workouts/${workoutId}/exercises`, {
        exerciseId: exercise.id,
        sets,
        reps,
        weightKg: weightNum !== null && Number.isFinite(weightNum) ? weightNum : null,
        restSec,
      });
      if (onAdded) {
        const fresh = await api.get<{ workout: Workout }>(`/workouts/${workoutId}`);
        onAdded(fresh.workout);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${exercise.name} to a workout`}
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/[0.08] bg-ink-800/95 p-6 backdrop-blur-xl sm:rounded-3xl animate-fade-up">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Add to workout
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-white">{exercise.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Existing vs new */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            disabled={!workouts || workouts.length === 0}
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              mode === "existing"
                ? "bg-white text-ink-900"
                : "border border-white/[0.08] bg-white/[0.03] text-zinc-300 disabled:opacity-40"
            }`}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              mode === "new"
                ? "bg-brand-gradient text-white shadow-glow-brand"
                : "border border-white/[0.08] bg-white/[0.03] text-zinc-300"
            }`}
          >
            New workout
          </button>
        </div>

        {mode === "existing" ? (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mb-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
          >
            {workouts?.map((w) => (
              <option key={w.id} value={w.id} className="bg-ink-900">
                {w.name}
                {w._count ? `  ·  ${w._count.entries} exercises` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Workout name (e.g. Push day)"
            className="mb-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/25 focus:outline-none"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <LabeledNumber label="Sets" value={sets} min={1} max={20} onChange={setSets} />
          <LabeledNumber label="Reps" value={reps} min={1} max={100} onChange={setReps} />
          <LabeledNumber
            label="Rest (s)"
            value={restSec}
            min={0}
            max={600}
            onChange={setRestSec}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">
              Weight (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              step="0.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="—"
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-rose-300">
            Could not save. Please try again.
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (mode === "existing" && !selectedId)}
            className="flex-1 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow-brand transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saving ? "Adding…" : "Add to workout"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
      />
    </div>
  );
}
