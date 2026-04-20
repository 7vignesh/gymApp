/**
 * Smart meal memory (Feature 3).
 *
 *   - After each meal save, `recordPattern` computes a signature from the
 *     sorted food names and either creates a new pattern row or increments
 *     `frequency` on an existing one, bucketed by user + time-of-day.
 *
 *   - `suggestPatterns` returns the top-K patterns for a (user, time-of-day)
 *     pair, ranked by recency-weighted frequency:
 *         score = frequency * exp(-ageDays / 14)
 *
 *   - Uses the `TimeOfDay` enum; `classifyTimeOfDay` maps a Date → bucket.
 */
import { prisma, TimeOfDay } from "@calai/db";
import type { MealEntry, Prisma } from "@calai/db";

export function classifyTimeOfDay(d: Date = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 4 && h < 11) return TimeOfDay.MORNING;
  if (h >= 11 && h < 15) return TimeOfDay.MIDDAY;
  if (h >= 15 && h < 21) return TimeOfDay.EVENING;
  return TimeOfDay.NIGHT;
}

/** Minimal entry shape used to build signatures + replayable payloads. */
export interface PatternEntry {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Deterministic signature: sorted lowercase food names joined with '|'. */
export function signatureFor(entries: { name: string }[]): string {
  return entries
    .map((e) => e.name.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

/**
 * Upsert a meal pattern for a given user.
 * If a pattern with the same signature + timeOfDay exists, we increment
 * `frequency` and refresh `lastUsedAt`. Otherwise a new row is created.
 */
export async function recordPattern(
  userId: string,
  entries: PatternEntry[],
  when: Date = new Date(),
): Promise<void> {
  if (entries.length === 0) return;
  const signature = signatureFor(entries);
  if (!signature) return;
  const timeOfDay = classifyTimeOfDay(when);

  // Strip IDs / relations before storing as JSON.
  const mealData: PatternEntry[] = entries.map((e) => ({
    name: e.name,
    quantity: e.quantity,
    unit: e.unit,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
  }));

  await prisma.userMealPattern.upsert({
    where: { userId_signature_timeOfDay: { userId, signature, timeOfDay } },
    update: {
      frequency: { increment: 1 },
      lastUsedAt: when,
      mealData: mealData as unknown as Prisma.InputJsonValue,
    },
    create: {
      userId,
      signature,
      timeOfDay,
      frequency: 1,
      lastUsedAt: when,
      mealData: mealData as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Convenience: accept Meal.entries rows straight from Prisma. */
export async function recordPatternFromEntries(
  userId: string,
  entries: MealEntry[],
  when: Date = new Date(),
): Promise<void> {
  return recordPattern(
    userId,
    entries.map((e) => ({
      name: e.name,
      quantity: e.quantity,
      unit: e.unit,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
    })),
    when,
  );
}

export interface SuggestedPattern {
  id: string;
  signature: string;
  frequency: number;
  timeOfDay: TimeOfDay;
  lastUsedAt: Date;
  entries: PatternEntry[];
  score: number;
}

/**
 * Suggest top meals for (user, timeOfDay). If `timeOfDay` is omitted we
 * blend suggestions across the current bucket + global top frequencies.
 */
export async function suggestPatterns(
  userId: string,
  opts: { timeOfDay?: TimeOfDay; limit?: number } = {},
): Promise<SuggestedPattern[]> {
  const limit = opts.limit ?? 6;
  const timeOfDay = opts.timeOfDay ?? classifyTimeOfDay();

  // Pull a pool from the preferred bucket + fallback pool from any bucket.
  const [sameBucket, anyBucket] = await Promise.all([
    prisma.userMealPattern.findMany({
      where: { userId, timeOfDay },
      orderBy: [{ frequency: "desc" }, { lastUsedAt: "desc" }],
      take: limit * 2,
    }),
    prisma.userMealPattern.findMany({
      where: { userId },
      orderBy: [{ frequency: "desc" }, { lastUsedAt: "desc" }],
      take: limit * 2,
    }),
  ]);

  // Merge (prefer same-bucket rows), dedupe by id.
  const seen = new Set<string>();
  const pool = [...sameBucket, ...anyBucket].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const now = Date.now();
  const scored: SuggestedPattern[] = pool.map((p) => {
    const ageDays = (now - p.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
    const score = p.frequency * Math.exp(-ageDays / 14);
    return {
      id: p.id,
      signature: p.signature,
      frequency: p.frequency,
      timeOfDay: p.timeOfDay,
      lastUsedAt: p.lastUsedAt,
      entries: (p.mealData as unknown as PatternEntry[]) ?? [],
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
