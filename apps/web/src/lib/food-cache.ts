/**
 * Client-side food cache (Feature 6 — Offline mode).
 *
 * Persists recent successful nutrition lookups so the app can estimate
 * calories when the API is unreachable. Uses localStorage; capped at
 * MAX_ENTRIES to avoid unbounded growth.
 */
"use client";

import type { ParseItem } from "./types";

const KEY = "calai.foodCache.v1";
const MAX_ENTRIES = 200;

interface CacheEntry {
  /** lowercase food name (key). */
  name: string;
  /** Representative nutrition per 1 unit of the stored unit. */
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  unit: string;
  savedAt: number;
}

function load(): CacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CacheEntry[];
  } catch {
    return [];
  }
}

function save(entries: CacheEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota exceeded / SSR — ignore */
  }
}

/** Merge successful lookups into the cache (call after online /parse). */
export function rememberLookups(items: ParseItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;
  const cache = load();
  const map = new Map(cache.map((e) => [e.name, e] as const));
  for (const it of items) {
    if (!it.name || !it.quantity || it.quantity <= 0) continue;
    const per = 1 / it.quantity;
    map.set(it.name.toLowerCase(), {
      name: it.name.toLowerCase(),
      caloriesPerUnit: it.calories * per,
      proteinPerUnit: it.protein * per,
      carbsPerUnit: it.carbs * per,
      fatPerUnit: it.fat * per,
      unit: it.unit,
      savedAt: Date.now(),
    });
  }
  const next = Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
  save(next);
}

/** Dead-simple local parser + estimator for offline input. */
export function estimateOffline(text: string): ParseItem[] {
  if (typeof window === "undefined") return [];
  const cache = load();
  if (cache.length === 0) return [];

  const chunks = text
    .toLowerCase()
    .split(/\s*(?:,|\band\b|\bwith\b|\+|&)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const out: ParseItem[] = [];
  for (const chunk of chunks) {
    // crude: extract leading number, rest is name
    const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)?\s+(.+)$/.exec(chunk);
    let quantity = 1;
    let name = chunk;
    if (m) {
      quantity = Number(m[1]);
      name = (m[3] ?? "").trim();
    }
    const hit = cache.find((e) => name.includes(e.name) || e.name.includes(name));
    if (!hit) continue;
    out.push({
      name: hit.name,
      quantity,
      unit: hit.unit,
      calories: Math.round(hit.caloriesPerUnit * quantity),
      protein: Math.round(hit.proteinPerUnit * quantity * 10) / 10,
      carbs: Math.round(hit.carbsPerUnit * quantity * 10) / 10,
      fat: Math.round(hit.fatPerUnit * quantity * 10) / 10,
      confidence: 0.4,
      matched: "offline-cache",
    });
  }
  return out;
}

export function cacheSize(): number {
  return load().length;
}
