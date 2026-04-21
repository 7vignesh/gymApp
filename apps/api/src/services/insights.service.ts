/**
 * Advanced insights engine (Feature 5).
 *
 *   • `dailyInsightsForUser(userId)` — today's snapshot
 *   • `weeklyInsightsForUser(userId)` — multi-day analysis
 *
 * Analyzers are deterministic (explainable, testable) and can optionally
 * be run through an LLM to produce friendlier copy. All insights degrade
 * gracefully when `OPENAI_API_KEY` is unset.
 *
 * The analyzers inspect per-meal-time macro distribution to produce
 * feedback like:
 *   - "Low protein intake in mornings"
 *   - "Excess carbs at night"
 *   - "Weekly calorie average is trending above your goal"
 */
import { prisma, TimeOfDay } from "@caloriex/db";
import type { Meal, MealEntry } from "@caloriex/db";
import { addDays, endOfDay, startOfDay } from "../utils/date";
import { classifyTimeOfDay } from "./meal-pattern.service";
import { generateInsights, type DailyLogSummary, type Insight } from "./ai.service";

type Totals = { calories: number; protein: number; carbs: number; fat: number };
const zero = (): Totals => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

function add(a: Totals, b: Totals): Totals {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

function mealTotals(m: Meal): Totals {
  return {
    calories: m.totalCalories,
    protein: m.totalProtein,
    carbs: m.totalCarbs,
    fat: m.totalFat,
  };
}

/* --------------------- TODAY's INSIGHTS --------------------- */

export async function dailyInsightsForUser(userId: string, date = new Date()): Promise<Insight[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const meals = await prisma.meal.findMany({
    where: { userId, consumedAt: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { entries: true },
    orderBy: { consumedAt: "asc" },
  });

  const totals = meals.reduce((a, m) => add(a, mealTotals(m)), zero());
  const goals: Totals = {
    calories: user.dailyCalorieGoal ?? 2000,
    protein: user.dailyProteinGoal ?? 120,
    carbs: user.dailyCarbsGoal ?? 250,
    fat: user.dailyFatGoal ?? 70,
  };

  // Deterministic analyzers first.
  const detInsights = [
    ...analyzeCalorieBudget(totals, goals),
    ...analyzeMealTimeMacros(meals),
    ...analyzeMacroBalance(totals, goals),
  ];

  // Optionally run LLM over a structured summary for friendlier copy.
  const summary: DailyLogSummary = {
    date: date.toISOString().slice(0, 10),
    totals,
    goals,
    meals: meals.map((m) => ({ name: m.notes ?? m.mealType, calories: m.totalCalories, mealType: m.mealType })),
  };

  const llm = await generateInsights(summary);

  return dedupe([...detInsights, ...llm]).slice(0, 6);
}

/* --------------------- WEEKLY INSIGHTS --------------------- */

export interface WeeklyInsightReport {
  range: { from: string; to: string; days: number };
  dailyTotals: { date: string; totals: Totals }[];
  avgPerDay: Totals;
  goals: Totals;
  insights: Insight[];
}

export async function weeklyInsightsForUser(
  userId: string,
  days = 7,
  until: Date = new Date(),
): Promise<WeeklyInsightReport> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const goals: Totals = {
    calories: user?.dailyCalorieGoal ?? 2000,
    protein: user?.dailyProteinGoal ?? 120,
    carbs: user?.dailyCarbsGoal ?? 250,
    fat: user?.dailyFatGoal ?? 70,
  };

  const from = startOfDay(addDays(until, -(days - 1)));
  const to = endOfDay(until);

  const meals = await prisma.meal.findMany({
    where: { userId, consumedAt: { gte: from, lte: to } },
    include: { entries: true },
    orderBy: { consumedAt: "asc" },
  });

  // Bucket by day
  const byDay = new Map<string, Meal[]>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    byDay.set(d.toISOString().slice(0, 10), []);
  }
  for (const m of meals) {
    const key = m.consumedAt.toISOString().slice(0, 10);
    byDay.get(key)?.push(m);
  }

  const dailyTotals = Array.from(byDay.entries()).map(([date, ms]) => ({
    date,
    totals: ms.reduce((a, m) => add(a, mealTotals(m)), zero()),
  }));

  const sum = dailyTotals.reduce((a, d) => add(a, d.totals), zero());
  const avgPerDay: Totals = {
    calories: Math.round(sum.calories / days),
    protein: Math.round(sum.protein / days),
    carbs: Math.round(sum.carbs / days),
    fat: Math.round(sum.fat / days),
  };

  // Deterministic weekly analyzers.
  const insights: Insight[] = [
    ...analyzeWeeklyTrend(dailyTotals, goals),
    ...analyzeConsistency(dailyTotals),
    ...analyzeMealTimeMacros(meals, { label: "this week" }),
  ];

  return {
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      days,
    },
    dailyTotals,
    avgPerDay,
    goals,
    insights: dedupe(insights).slice(0, 6),
  };
}

/* --------------------- analyzers --------------------- */

function analyzeCalorieBudget(totals: Totals, goals: Totals): Insight[] {
  if (totals.calories === 0) {
    return [{ headline: "No meals logged yet", detail: "Log a meal to see insights.", severity: "info" }];
  }
  const ratio = totals.calories / goals.calories;
  if (ratio > 1.1) {
    return [{
      headline: "Over your calorie goal",
      detail: `${Math.round(totals.calories)} kcal vs a ${goals.calories} kcal goal (+${Math.round((ratio - 1) * 100)}%).`,
      severity: "warn",
    }];
  }
  if (ratio < 0.7) {
    return [{
      headline: "Under your calorie target",
      detail: `Only ${Math.round(totals.calories)} kcal logged — consider a balanced snack.`,
      severity: "info",
    }];
  }
  return [{
    headline: "On track today",
    detail: `${Math.round(totals.calories)} kcal logged — within a healthy range of your goal.`,
    severity: "good",
  }];
}

function analyzeMacroBalance(totals: Totals, goals: Totals): Insight[] {
  const out: Insight[] = [];
  if (totals.calories === 0) return out;
  if (totals.protein < goals.protein * 0.6) {
    out.push({
      headline: "Protein intake is low",
      detail: `${Math.round(totals.protein)}g of ${goals.protein}g goal. Try eggs, paneer, dal, or chicken.`,
      severity: "warn",
    });
  }
  if (totals.fat > goals.fat * 1.3) {
    out.push({
      headline: "Fat intake is high",
      detail: `${Math.round(totals.fat)}g vs ${goals.fat}g goal. Watch out for fried/rich dishes.`,
      severity: "warn",
    });
  }
  return out;
}

/** Splits meals into 4 time-of-day buckets and flags macro anomalies. */
function analyzeMealTimeMacros(
  meals: (Meal & { entries: MealEntry[] })[],
  opts: { label?: string } = {},
): Insight[] {
  const buckets: Record<TimeOfDay, Totals> = {
    MORNING: zero(),
    MIDDAY: zero(),
    EVENING: zero(),
    NIGHT: zero(),
  };
  for (const m of meals) {
    const b = classifyTimeOfDay(m.consumedAt);
    buckets[b] = add(buckets[b], mealTotals(m));
  }

  const out: Insight[] = [];
  const suffix = opts.label ? ` (${opts.label})` : "";

  // Low morning protein.
  if (buckets.MORNING.calories > 0 && buckets.MORNING.protein < 12) {
    out.push({
      headline: `Low protein in mornings${suffix}`,
      detail: `Only ${Math.round(buckets.MORNING.protein)}g at breakfast. Adding eggs or paneer keeps you full longer.`,
      severity: "warn",
    });
  }

  // Heavy late-night carbs.
  if (buckets.NIGHT.carbs > 60) {
    out.push({
      headline: `Excess carbs at night${suffix}`,
      detail: `${Math.round(buckets.NIGHT.carbs)}g carbs after 9pm — can disrupt sleep quality.`,
      severity: "warn",
    });
  }

  // Evening dominates calories.
  const total = (Object.keys(buckets) as TimeOfDay[]).reduce(
    (a, k) => a + buckets[k].calories,
    0,
  );
  if (total > 0 && buckets.EVENING.calories / total > 0.55) {
    out.push({
      headline: `Calorie-heavy evenings${suffix}`,
      detail: `Over half your calories arrive after 3pm. Try a bigger breakfast.`,
      severity: "info",
    });
  }

  return out;
}

function analyzeWeeklyTrend(
  dailyTotals: { date: string; totals: Totals }[],
  goals: Totals,
): Insight[] {
  const loggedDays = dailyTotals.filter((d) => d.totals.calories > 0);
  if (loggedDays.length < 3) return [];

  const avgCal = loggedDays.reduce((a, d) => a + d.totals.calories, 0) / loggedDays.length;
  const avgProt = loggedDays.reduce((a, d) => a + d.totals.protein, 0) / loggedDays.length;

  const out: Insight[] = [];
  if (avgCal > goals.calories * 1.08) {
    out.push({
      headline: "Weekly calories trending high",
      detail: `Average ${Math.round(avgCal)} kcal/day (goal ${goals.calories}). Small cuts at snacks can fix this.`,
      severity: "warn",
    });
  } else if (avgCal < goals.calories * 0.8) {
    out.push({
      headline: "You're eating below your target",
      detail: `Average ${Math.round(avgCal)} kcal/day vs ${goals.calories}. Under-eating can stall progress.`,
      severity: "info",
    });
  }
  if (avgProt < goals.protein * 0.7) {
    out.push({
      headline: "Weekly protein is short",
      detail: `${Math.round(avgProt)}g avg/day — aim for ${goals.protein}g.`,
      severity: "warn",
    });
  }
  return out;
}

function analyzeConsistency(
  dailyTotals: { date: string; totals: Totals }[],
): Insight[] {
  const gaps = dailyTotals.filter((d) => d.totals.calories === 0).length;
  if (gaps >= 3) {
    return [{
      headline: "Logging gaps detected",
      detail: `${gaps} days without any meals logged. Consistency drives insights.`,
      severity: "info",
    }];
  }
  return [];
}

/** Deduplicate by headline (prefer deterministic copy over LLM paraphrase). */
function dedupe(list: Insight[]): Insight[] {
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const i of list) {
    const key = i.headline.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  return out;
}
