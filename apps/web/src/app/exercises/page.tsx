"use client";

/**
 * Exercise Library.
 *
 * - If user has no saved muscle preferences → shows the MuscleGroupSelector
 *   as an inline onboarding step. Skip → loads the full library.
 * - If user has saved preferences → default filter = their muscle groups.
 * - Filter state (bodyPart / equipment / level / search / sort / page)
 *   is synced to URL query params so links + refresh are stable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  MUSCLE_GROUPS,
  type Exercise,
  type ExerciseListResponse,
  type FilterMeta,
  type MuscleGroup,
  type MusclePreference,
} from "@/lib/types";
import { MuscleGroupSelector } from "@/components/muscle-group-selector";
import { ExerciseCard, ExerciseCardSkeleton } from "@/components/exercise-card";

const BODY_PART_TABS = ["all", ...MUSCLE_GROUPS] as const;
const EQUIPMENT_PILLS = [
  { id: "all", label: "All" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "machine", label: "Machine" },
  { id: "freeweight", label: "Free Weights" },
  { id: "cable", label: "Cable" },
  { id: "bands", label: "Bands" },
] as const;
const LEVEL_PILLS = [
  { id: "all", label: "All" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;
const SORT_OPTS = [
  { id: "alpha", label: "A-Z" },
  { id: "level", label: "Difficulty" },
  { id: "newest", label: "Newest" },
] as const;

type EquipmentId = (typeof EQUIPMENT_PILLS)[number]["id"];
type LevelId = (typeof LEVEL_PILLS)[number]["id"];
type SortId = (typeof SORT_OPTS)[number]["id"];

interface FilterState {
  bodyPart: string; // "all" or a MuscleGroup
  equipment: EquipmentId;
  level: LevelId;
  search: string;
  sort: SortId;
  page: number;
}

function readFilters(sp: URLSearchParams): FilterState {
  return {
    bodyPart: sp.get("bodyPart") ?? "all",
    equipment: (sp.get("equipment") as EquipmentId) ?? "all",
    level: (sp.get("level") as LevelId) ?? "all",
    search: sp.get("q") ?? "",
    sort: (sp.get("sort") as SortId) ?? "alpha",
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
  };
}

function buildApiQuery(f: FilterState, fallbackBodyParts: MuscleGroup[]): string {
  const params = new URLSearchParams();

  if (f.bodyPart !== "all") {
    params.set("bodyPart", f.bodyPart);
  } else if (fallbackBodyParts.length) {
    params.set("bodyPart", fallbackBodyParts.join(","));
  }

  switch (f.equipment) {
    case "bodyweight":
      params.set("isBodyweight", "true");
      break;
    case "machine":
      params.set("isMachine", "true");
      break;
    case "freeweight":
      params.set("isFreeWeight", "true");
      break;
    case "cable":
      params.set("isCable", "true");
      break;
    case "bands":
      params.set("isBands", "true");
      break;
  }

  if (f.level !== "all") params.set("level", f.level);
  if (f.search.trim()) params.set("search", f.search.trim());
  if (f.sort) params.set("sort", f.sort);
  params.set("page", String(f.page));
  params.set("limit", "24");

  return params.toString();
}

export default function ExerciseLibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse current filters from URL — single source of truth.
  const filters = useMemo<FilterState>(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [searchInput, setSearchInput] = useState(filters.search);
  const [preferences, setPreferences] = useState<MusclePreference | null | "loading">(
    "loading",
  );
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [data, setData] = useState<ExerciseListResponse | null>(null);
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Load preferences + filter meta once.
  useEffect(() => {
    api
      .get<{ preference: MusclePreference | null }>("/user/muscle-preferences")
      .then((r) => setPreferences(r.preference))
      .catch(() => setPreferences(null));

    api
      .get<FilterMeta>("/exercises/filters/meta")
      .then(setMeta)
      .catch(() => {});
  }, []);

  const showOnboarding =
    preferences !== "loading" &&
    (preferences === null || preferences.muscleGroups.length === 0) &&
    !skippedOnboarding;

  const savedMuscles: MuscleGroup[] =
    preferences && preferences !== "loading" ? (preferences.muscleGroups as MuscleGroup[]) : [];

  // 2. Fetch list whenever filters (or preferences baseline) change.
  const fetchIdRef = useRef(0);
  useEffect(() => {
    if (showOnboarding || preferences === "loading") return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    const qs = buildApiQuery(filters, savedMuscles);

    api
      .get<ExerciseListResponse>(`/exercises?${qs}`)
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        setData(res);
      })
      .catch((err: ApiError) => {
        if (id !== fetchIdRef.current) return;
        setError(err.message ?? "request_failed");
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [filters, showOnboarding, preferences, savedMuscles]);

  // 3. Helpers — update URL (single source of truth).
  const updateFilters = useCallback(
    (next: Partial<FilterState>) => {
      const merged = { ...filters, ...next };
      if (!("page" in next)) merged.page = 1; // reset pagination on any filter change
      const params = new URLSearchParams();
      if (merged.bodyPart !== "all") params.set("bodyPart", merged.bodyPart);
      if (merged.equipment !== "all") params.set("equipment", merged.equipment);
      if (merged.level !== "all") params.set("level", merged.level);
      if (merged.search) params.set("q", merged.search);
      if (merged.sort !== "alpha") params.set("sort", merged.sort);
      if (merged.page !== 1) params.set("page", String(merged.page));
      router.replace(`/exercises${params.toString() ? `?${params}` : ""}`);
    },
    [filters, router],
  );

  // 4. Debounced search → URL.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const t = setTimeout(() => updateFilters({ search: searchInput }), 300);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, updateFilters]);

  // 5. Save onboarding.
  const handleSavePrefs = async (groups: MuscleGroup[]) => {
    setSavingPrefs(true);
    try {
      const res = await api.put<{ preference: MusclePreference }>(
        "/user/muscle-preferences",
        { muscleGroups: groups },
      );
      setPreferences(res.preference);
    } catch {
      // swallow; onboarding stays visible so the user can retry
    } finally {
      setSavingPrefs(false);
    }
  };

  // ---------- render ----------

  const items = data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Exercise Library
        </h1>
        <p className="text-sm text-zinc-400">
          Curated by your target muscles. Filter by equipment & difficulty.
        </p>
      </header>

      {showOnboarding ? (
        <MuscleGroupSelector
          onSave={handleSavePrefs}
          onSkip={() => setSkippedOnboarding(true)}
          saving={savingPrefs}
          title="What are you training?"
          subtitle="Pick one or more muscle groups — we'll shape your library around them."
          ctaLabel="Save & explore"
        />
      ) : (
        <>
          {/* Preferences chip + edit */}
          {savedMuscles.length > 0 && filters.bodyPart === "all" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs text-zinc-400">
              <span className="uppercase tracking-wider text-zinc-500">Your focus</span>
              {savedMuscles.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 capitalize text-zinc-200"
                >
                  {m}
                </span>
              ))}
              <button
                type="button"
                className="ml-auto rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-white"
                onClick={() => setPreferences(null)}
              >
                Edit
              </button>
            </div>
          )}

          {/* Body-part tabs */}
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {BODY_PART_TABS.map((bp) => {
              const active = filters.bodyPart === bp;
              return (
                <button
                  key={bp}
                  type="button"
                  onClick={() => updateFilters({ bodyPart: bp })}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                    active
                      ? "bg-brand-gradient text-white shadow-glow-brand"
                      : "border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {bp === "all" ? "All" : bp}
                </button>
              );
            })}
          </div>

          {/* Equipment + level pills + sort */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_PILLS.map((p) => {
                const active = filters.equipment === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateFilters({ equipment: p.id })}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                      active
                        ? "bg-white text-ink-900"
                        : "border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-[11px] uppercase tracking-wider text-zinc-500">
                Sort
              </label>
              <select
                id="sort"
                value={filters.sort}
                onChange={(e) => updateFilters({ sort: e.target.value as SortId })}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white focus:border-white/20 focus:outline-none"
              >
                {SORT_OPTS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink-900">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {LEVEL_PILLS.map((p) => {
              const active = filters.level === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateFilters({ level: p.id })}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                    active
                      ? "bg-white text-ink-900"
                      : "border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search exercises, e.g. squat, pull-up…"
              aria-label="Search exercises"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 pl-10 text-sm text-white placeholder:text-zinc-500 transition-colors hover:border-white/15 focus:border-white/25 focus:outline-none"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </div>

          {/* Results */}
          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-300">
              Something went wrong. Please try again.
            </div>
          ) : loading && !data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ExerciseCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
              <p className="text-sm text-zinc-400">
                No exercises found. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                Showing {items.length} of {data?.total ?? 0}
                {loading ? " (updating…)" : ""}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((ex: Exercise) => (
                  <ExerciseCard key={ex.id} exercise={ex} />
                ))}
              </div>

              {/* Pagination */}
              {(data?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={filters.page <= 1}
                    onClick={() => updateFilters({ page: filters.page - 1 })}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-zinc-400">
                    Page {filters.page} / {data?.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={filters.page >= (data?.totalPages ?? 1)}
                    onClick={() => updateFilters({ page: filters.page + 1 })}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Hidden: surface meta existence without rendering anything if backend not seeded */}
      {meta && meta.bodyParts.length === 0 && !showOnboarding && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
          Exercise library is empty. Run <code className="font-mono">bun run db:seed:exercises</code> to import the dataset.
        </div>
      )}
    </div>
  );
}
