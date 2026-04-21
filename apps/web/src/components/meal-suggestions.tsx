"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMealsStore } from "@/store/meals";

interface PatternEntry {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SuggestedPattern {
  id: string;
  signature: string;
  frequency: number;
  timeOfDay: string;
  lastUsedAt: string;
  entries: PatternEntry[];
  score: number;
}

interface Resp {
  timeOfDay: string;
  items: SuggestedPattern[];
}

export function MealSuggestions({
  onPick,
}: {
  onPick?: (signature: string, entries: PatternEntry[]) => void;
}) {
  const [data, setData] = useState<Resp | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { loadToday } = useMealsStore();

  useEffect(() => {
    api.get<Resp>("/meal-patterns/suggestions").then(setData).catch(() => setData(null));
  }, []);

  if (!data || data.items.length === 0) return null;

  async function quickLog(id: string) {
    setLoadingId(id);
    try {
      await api.post(`/meal-patterns/${id}/log`);
      await loadToday();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Frequent · {data.timeOfDay.toLowerCase()}
        </h2>
      </div>
      <div className="stagger flex flex-wrap gap-2">
        {data.items.map((p) => {
          const label = p.entries.map((e) => e.name).join(", ");
          const cals = Math.round(p.entries.reduce((a, e) => a + e.calories, 0));
          return (
            <div
              key={p.id}
              className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1 text-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]"
            >
              <button
                onClick={() => onPick?.(p.signature, p.entries)}
                className="max-w-[180px] truncate text-zinc-300 transition-colors group-hover:text-white"
                title={label}
              >
                {label}
              </button>
              <span className="tabular-nums text-[10px] text-zinc-500">
                {cals} kcal · ×{p.frequency}
              </span>
              <button
                onClick={() => quickLog(p.id)}
                disabled={loadingId === p.id}
                className="ml-1 h-7 rounded-full bg-brand-gradient px-3 text-xs font-medium text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)] transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
                title="Log this meal now"
              >
                {loadingId === p.id ? "…" : "+ Log"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
