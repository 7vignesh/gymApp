/**
 * Analytics routes: weekly / range summaries for charts.
 *   GET /analytics/weekly?weeks=1 → last N*7 days, daily totals
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@calai/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { addDays, formatISODate, startOfDay, endOfDay } from "../utils/date";
import { weeklyInsightsForUser } from "../services/insights.service";

export const analyticsRoutes = new Hono<AuthContext>();
analyticsRoutes.use("*", requireAuth);

analyticsRoutes.get(
  "/weekly",
  zValidator(
    "query",
    z.object({ weeks: z.coerce.number().int().min(1).max(12).default(1) }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { weeks } = c.req.valid("query");
    const days = weeks * 7;

    const now = new Date();
    const from = startOfDay(addDays(now, -(days - 1)));
    const to = endOfDay(now);

    const meals = await prisma.meal.findMany({
      where: { userId, consumedAt: { gte: from, lte: to } },
      select: {
        consumedAt: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
      },
    });

    // Bucket by day (YYYY-MM-DD in UTC-safe local).
    const buckets = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >();
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      buckets.set(formatISODate(d), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }
    for (const m of meals) {
      const key = formatISODate(m.consumedAt);
      const slot = buckets.get(key);
      if (!slot) continue;
      slot.calories += m.totalCalories;
      slot.protein += m.totalProtein;
      slot.carbs += m.totalCarbs;
      slot.fat += m.totalFat;
    }

    const series = Array.from(buckets.entries()).map(([date, t]) => ({
      date,
      ...t,
    }));

    const avg = series.reduce(
      (a, s) => ({
        calories: a.calories + s.calories,
        protein: a.protein + s.protein,
        carbs: a.carbs + s.carbs,
        fat: a.fat + s.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const avgPerDay = {
      calories: series.length ? Math.round(avg.calories / series.length) : 0,
      protein: series.length ? Math.round(avg.protein / series.length) : 0,
      carbs: series.length ? Math.round(avg.carbs / series.length) : 0,
      fat: series.length ? Math.round(avg.fat / series.length) : 0,
    };

    return c.json({ series, avgPerDay });
  },
);

// ---------- GET /analytics/insights?days=7 (Feature 5) ----------

analyticsRoutes.get(
  "/insights",
  zValidator(
    "query",
    z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { days } = c.req.valid("query");
    const report = await weeklyInsightsForUser(userId, days);
    return c.json(report);
  },
);
