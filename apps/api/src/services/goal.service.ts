/**
 * Adaptive goal system (Feature 7).
 *
 * Responsibilities:
 *   - Estimate TDEE (Mifflin–St Jeor × activity multiplier).
 *   - Compute target calories for LOSE/MAINTAIN/GAIN.
 *   - Analyze weight progress (last 14 days) vs intent, and adapt the
 *     calorie goal by ±10% when progress is off-target.
 *   - Derive balanced macro goals (25% P / 45% C / 30% F by default).
 *
 * Idempotent: safe to call on every login / once-weekly cron.
 */
import { prisma, type User, type WeightLog, ActivityLevel, GoalType, Sex } from "@caloriex/db";
import { addDays } from "../utils/date";

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT:     1.375,
  MODERATE:  1.55,
  ACTIVE:    1.725,
  ATHLETE:   1.9,
};

/** BMR (kcal/day) via Mifflin–St Jeor. Returns null if inputs insufficient. */
export function bmrMifflinStJeor(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}): number {
  const { weightKg, heightCm, age, sex } = opts;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === Sex.MALE ? 5 : -161));
}

export function tdeeFor(user: User, weightKg: number): number | null {
  if (!user.heightCm || !user.birthYear || !user.sex) return null;
  const age = new Date().getFullYear() - user.birthYear;
  const bmr = bmrMifflinStJeor({
    weightKg,
    heightCm: user.heightCm,
    age,
    sex: user.sex,
  });
  return Math.round(bmr * ACTIVITY_MULTIPLIER[user.activityLevel]);
}

export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Given a calorie target, distribute macros (P 25%, C 45%, F 30%). */
export function macrosFor(calories: number): MacroGoals {
  const pCal = calories * 0.25;
  const cCal = calories * 0.45;
  const fCal = calories * 0.30;
  return {
    calories: Math.round(calories),
    protein: Math.round(pCal / KCAL_PER_G.protein),
    carbs: Math.round(cCal / KCAL_PER_G.carbs),
    fat: Math.round(fCal / KCAL_PER_G.fat),
  };
}

/** Base calorie target from TDEE + GoalType (without adaptation). */
export function baseCalorieTarget(user: User, weightKg: number): number | null {
  const tdee = tdeeFor(user, weightKg);
  if (!tdee) return null;
  switch (user.goalType) {
    case GoalType.LOSE:     return Math.round(tdee - 500);   // ~0.45 kg/wk
    case GoalType.GAIN:     return Math.round(tdee + 350);   // lean bulk
    case GoalType.MAINTAIN:
    default:                return tdee;
  }
}

/* --------------------- weight trend analysis --------------------- */

export interface WeightTrend {
  slopeKgPerWeek: number | null;   // linear regression over last 14 days
  latestWeightKg: number | null;
  daysOfData: number;
}

/** Linear regression on (day, weight) pairs. */
export function analyzeWeightTrend(logs: WeightLog[]): WeightTrend {
  if (logs.length === 0) {
    return { slopeKgPerWeek: null, latestWeightKg: null, daysOfData: 0 };
  }
  const sorted = [...logs].sort(
    (a, b) => a.loggedAt.getTime() - b.loggedAt.getTime(),
  );
  const t0 = sorted[0]!.loggedAt.getTime();
  const pts = sorted.map((l) => ({
    x: (l.loggedAt.getTime() - t0) / (1000 * 60 * 60 * 24), // days
    y: l.weightKg,
  }));

  if (pts.length < 2) {
    return {
      slopeKgPerWeek: null,
      latestWeightKg: sorted[sorted.length - 1]!.weightKg,
      daysOfData: 1,
    };
  }

  const n = pts.length;
  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slopePerDay = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;

  return {
    slopeKgPerWeek: slopePerDay * 7,
    latestWeightKg: sorted[sorted.length - 1]!.weightKg,
    daysOfData: Math.ceil(pts[pts.length - 1]!.x) + 1,
  };
}

/* --------------------- adaptive adjustment --------------------- */

export interface GoalAdaptation {
  baseCalories: number | null;
  adjustedCalories: number | null;
  macros: MacroGoals | null;
  trend: WeightTrend;
  reason: string;
  changed: boolean;
  /** adjustment factor applied to baseCalories (e.g. 0.9, 1.0, 1.1) */
  factor: number;
}

export async function computeAdaptiveGoals(userId: string): Promise<GoalAdaptation> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return emptyAdaptation("User not found");
  }

  // Use most recent logged weight, else stored currentWeightKg.
  const recent = await prisma.weightLog.findMany({
    where: { userId, loggedAt: { gte: addDays(new Date(), -21) } },
    orderBy: { loggedAt: "desc" },
  });
  const latest = recent[0]?.weightKg ?? user.currentWeightKg;
  if (!latest) return emptyAdaptation("No weight data yet. Log your weight to enable adaptive goals.");

  const base = baseCalorieTarget(user, latest);
  if (!base) {
    return {
      baseCalories: null,
      adjustedCalories: null,
      macros: null,
      trend: analyzeWeightTrend(recent),
      reason: "Incomplete profile (need height, birth year, and sex).",
      changed: false,
      factor: 1,
    };
  }

  const trend = analyzeWeightTrend(recent);

  // Decide adjustment factor based on 14-day slope vs intent.
  let factor = 1;
  let reason = "On track — no adjustment needed.";
  if (trend.slopeKgPerWeek !== null && trend.daysOfData >= 10) {
    const slope = trend.slopeKgPerWeek;
    if (user.goalType === GoalType.LOSE) {
      if (slope > -0.1) { factor = 0.9; reason = "Not losing as fast as expected — tightening calories by 10%."; }
      else if (slope < -0.9) { factor = 1.05; reason = "Losing weight too fast — loosening calories by 5% to protect muscle."; }
    } else if (user.goalType === GoalType.GAIN) {
      if (slope < 0.05) { factor = 1.1; reason = "Not gaining — raising calories by 10%."; }
      else if (slope > 0.5) { factor = 0.95; reason = "Gaining too fast — easing calories down by 5%."; }
    } else {
      // MAINTAIN
      if (Math.abs(slope) > 0.3) {
        factor = slope > 0 ? 0.95 : 1.05;
        reason = slope > 0
          ? "Drifting above maintenance — trimming 5%."
          : "Drifting below maintenance — adding 5%.";
      }
    }
  } else {
    reason = "Not enough weight data yet (log daily for 10+ days to enable adaptation).";
  }

  const adjusted = Math.round(base * factor);
  const macros = macrosFor(adjusted);
  const changed =
    adjusted !== user.dailyCalorieGoal ||
    macros.protein !== user.dailyProteinGoal ||
    macros.carbs !== user.dailyCarbsGoal ||
    macros.fat !== user.dailyFatGoal;

  return {
    baseCalories: base,
    adjustedCalories: adjusted,
    macros,
    trend,
    reason,
    changed,
    factor,
  };
}

/** Apply the adaptation and persist to User. */
export async function applyAdaptiveGoals(userId: string): Promise<GoalAdaptation & { applied: boolean }> {
  const adaptation = await computeAdaptiveGoals(userId);
  if (!adaptation.macros) return { ...adaptation, applied: false };
  if (!adaptation.changed) return { ...adaptation, applied: false };
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyCalorieGoal: adaptation.macros.calories,
      dailyProteinGoal: adaptation.macros.protein,
      dailyCarbsGoal: adaptation.macros.carbs,
      dailyFatGoal: adaptation.macros.fat,
      goalsLastAdjusted: new Date(),
    },
  });
  return { ...adaptation, applied: true };
}

function emptyAdaptation(reason: string): GoalAdaptation {
  return {
    baseCalories: null,
    adjustedCalories: null,
    macros: null,
    trend: { slopeKgPerWeek: null, latestWeightKg: null, daysOfData: 0 },
    reason,
    changed: false,
    factor: 1,
  };
}
