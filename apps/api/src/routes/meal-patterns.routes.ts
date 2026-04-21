/**
 * Smart meal memory routes (Feature 3).
 *   GET  /meal-patterns/suggestions?time=MORNING|MIDDAY|EVENING|NIGHT
 *   POST /meal-patterns/:id/log    → log this pattern as a new meal right now
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma, MealSource, MealType, TimeOfDay } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { AppError } from "../middleware/error";
import {
  classifyTimeOfDay,
  recordPatternFromEntries,
  suggestPatterns,
  type PatternEntry,
} from "../services/meal-pattern.service";

export const mealPatternsRoutes = new Hono<AuthContext>();
mealPatternsRoutes.use("*", requireAuth);

// ---------- GET /meal-patterns/suggestions ----------
mealPatternsRoutes.get(
  "/suggestions",
  zValidator(
    "query",
    z.object({
      time: z.nativeEnum(TimeOfDay).optional(),
      limit: z.coerce.number().int().min(1).max(20).default(6),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { time, limit } = c.req.valid("query");
    const items = await suggestPatterns(userId, { timeOfDay: time, limit });
    return c.json({
      timeOfDay: time ?? classifyTimeOfDay(),
      items,
    });
  },
);

// Infer MealType from TimeOfDay for one-tap re-log.
function inferMealType(tod: TimeOfDay): MealType {
  switch (tod) {
    case TimeOfDay.MORNING: return MealType.BREAKFAST;
    case TimeOfDay.MIDDAY:  return MealType.LUNCH;
    case TimeOfDay.EVENING: return MealType.DINNER;
    case TimeOfDay.NIGHT:   return MealType.SNACK;
  }
}

// ---------- POST /meal-patterns/:id/log ----------
mealPatternsRoutes.post("/:id/log", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const pattern = await prisma.userMealPattern.findFirst({
    where: { id, userId },
  });
  if (!pattern) throw new AppError(404, "pattern_not_found");

  const entries = (pattern.mealData as unknown as PatternEntry[]) ?? [];
  if (entries.length === 0) throw new AppError(422, "pattern_empty");

  const totals = entries.reduce(
    (a, e) => ({
      cals: a.cals + e.calories,
      p: a.p + e.protein,
      c: a.c + e.carbs,
      f: a.f + e.fat,
    }),
    { cals: 0, p: 0, c: 0, f: 0 },
  );

  const now = new Date();
  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType: inferMealType(classifyTimeOfDay(now)),
      source: MealSource.SUGGESTION,
      notes: "Re-logged from previous meal",
      consumedAt: now,
      totalCalories: totals.cals,
      totalProtein: totals.p,
      totalCarbs: totals.c,
      totalFat: totals.f,
      entries: { create: entries.map((e) => ({ userId, ...e })) },
    },
    include: { entries: true },
  });

  void recordPatternFromEntries(userId, meal.entries, now).catch(() => {});
  return c.json({ meal }, 201);
});
