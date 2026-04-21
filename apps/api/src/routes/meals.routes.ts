/**
 * Meal routes — CRUD + convenience endpoints.
 *   GET    /meals                 → list meals (query: date=YYYY-MM-DD | from/to)
 *   GET    /meals/today           → today's meals with totals
 *   POST   /meals/text            → create meal from free text (uses parser + nutrition)
 *   POST   /meals                 → create meal from structured entries
 *   PATCH  /meals/:id             → edit meal metadata (notes, mealType)
 *   PATCH  /meals/:id/entries/:entryId → edit a single food entry (user corrects AI)
 *   DELETE /meals/:id             → delete meal
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma, MealSource, MealType } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { parseFoodText } from "../services/food-parser.service";
import { estimateNutritionAll } from "../services/nutrition.service";
import { recordPatternFromEntries } from "../services/meal-pattern.service";
import { startOfDay, endOfDay } from "../utils/date";

export const mealsRoutes = new Hono<AuthContext>();
mealsRoutes.use("*", requireAuth);

// ---------- GET /meals ----------

const ListQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

mealsRoutes.get("/", zValidator("query", ListQuery), async (c) => {
  const userId = c.get("userId");
  const { date, from, to } = c.req.valid("query");

  const where: Record<string, unknown> = { userId };
  if (date) {
    const d = new Date(date);
    where.consumedAt = { gte: startOfDay(d), lte: endOfDay(d) };
  } else if (from || to) {
    where.consumedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const meals = await prisma.meal.findMany({
    where,
    include: { entries: true },
    orderBy: { consumedAt: "desc" },
  });
  return c.json({ meals });
});

// ---------- GET /meals/today ----------

mealsRoutes.get("/today", async (c) => {
  const userId = c.get("userId");
  const now = new Date();
  const meals = await prisma.meal.findMany({
    where: { userId, consumedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
    include: { entries: true },
    orderBy: { consumedAt: "asc" },
  });

  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.totalCalories,
      protein: a.protein + m.totalProtein,
      carbs: a.carbs + m.totalCarbs,
      fat: a.fat + m.totalFat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return c.json({ meals, totals });
});

// ---------- POST /meals/text (phase 1 core flow) ----------

const TextMealSchema = z.object({
  text: z.string().min(1).max(2000),
  mealType: z.nativeEnum(MealType).default(MealType.SNACK),
  consumedAt: z.string().datetime().optional(),
});

mealsRoutes.post("/text", zValidator("json", TextMealSchema), async (c) => {
  const userId = c.get("userId");
  const { text, mealType, consumedAt } = c.req.valid("json");

  const parsed = parseFoodText(text);
  if (parsed.length === 0) throw new AppError(422, "no_food_detected");

  const nutrition = await estimateNutritionAll(parsed);
  const totals = nutrition.reduce(
    (a, n) => ({
      cals: a.cals + n.calories,
      p: a.p + n.protein,
      c: a.c + n.carbs,
      f: a.f + n.fat,
    }),
    { cals: 0, p: 0, c: 0, f: 0 },
  );

  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType,
      source: MealSource.TEXT,
      notes: text,
      consumedAt: consumedAt ? new Date(consumedAt) : new Date(),
      totalCalories: totals.cals,
      totalProtein: totals.p,
      totalCarbs: totals.c,
      totalFat: totals.f,
      entries: {
        create: nutrition.map((n) => ({
          userId,
          name: n.name,
          quantity: n.quantity,
          unit: n.unit,
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          aiConfidence: n.confidence,
        })),
      },
    },
    include: { entries: true },
  });

  // Fire-and-forget: update smart meal memory.
  void recordPatternFromEntries(userId, meal.entries, meal.consumedAt).catch(
    (e) => console.warn("[meals] pattern record failed:", e),
  );

  return c.json({ meal }, 201);
});

// ---------- POST /meals (structured) ----------

const EntrySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  calories: z.number().min(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  aiConfidence: z.number().min(0).max(1).optional(),
});

const StructuredMealSchema = z.object({
  mealType: z.nativeEnum(MealType).default(MealType.SNACK),
  source: z.nativeEnum(MealSource).default(MealSource.MANUAL),
  notes: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  consumedAt: z.string().datetime().optional(),
  entries: z.array(EntrySchema).min(1),
});

mealsRoutes.post("/", zValidator("json", StructuredMealSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const totals = body.entries.reduce(
    (a, e) => ({
      cals: a.cals + e.calories,
      p: a.p + e.protein,
      c: a.c + e.carbs,
      f: a.f + e.fat,
    }),
    { cals: 0, p: 0, c: 0, f: 0 },
  );

  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType: body.mealType,
      source: body.source,
      notes: body.notes,
      imageUrl: body.imageUrl,
      consumedAt: body.consumedAt ? new Date(body.consumedAt) : new Date(),
      totalCalories: totals.cals,
      totalProtein: totals.p,
      totalCarbs: totals.c,
      totalFat: totals.f,
      entries: { create: body.entries.map((e) => ({ userId, ...e })) },
    },
    include: { entries: true },
  });
  void recordPatternFromEntries(userId, meal.entries, meal.consumedAt).catch(
    (e) => console.warn("[meals] pattern record failed:", e),
  );
  return c.json({ meal }, 201);
});

// ---------- PATCH /meals/:id ----------

mealsRoutes.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      mealType: z.nativeEnum(MealType).optional(),
      notes: z.string().max(2000).optional(),
      consumedAt: z.string().datetime().optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const existing = await prisma.meal.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, "meal_not_found");
    const meal = await prisma.meal.update({
      where: { id },
      data: {
        ...body,
        consumedAt: body.consumedAt ? new Date(body.consumedAt) : undefined,
      },
      include: { entries: true },
    });
    return c.json({ meal });
  },
);

// ---------- PATCH /meals/:id/entries/:entryId (user edits AI) ----------

mealsRoutes.patch(
  "/:id/entries/:entryId",
  zValidator(
    "json",
    EntrySchema.partial().extend({ userEdited: z.boolean().default(true) }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const entryId = c.req.param("entryId");
    const body = c.req.valid("json");

    const meal = await prisma.meal.findFirst({ where: { id, userId } });
    if (!meal) throw new AppError(404, "meal_not_found");

    await prisma.mealEntry.update({
      where: { id: entryId },
      data: { ...body, userEdited: body.userEdited ?? true },
    });

    // Recompute denormalized totals.
    const entries = await prisma.mealEntry.findMany({ where: { mealId: id } });
    const totals = entries.reduce(
      (a, e) => ({
        cals: a.cals + e.calories,
        p: a.p + e.protein,
        c: a.c + e.carbs,
        f: a.f + e.fat,
      }),
      { cals: 0, p: 0, c: 0, f: 0 },
    );
    const updated = await prisma.meal.update({
      where: { id },
      data: {
        totalCalories: totals.cals,
        totalProtein: totals.p,
        totalCarbs: totals.c,
        totalFat: totals.f,
      },
      include: { entries: true },
    });
    return c.json({ meal: updated });
  },
);

// ---------- DELETE /meals/:id ----------

mealsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, "meal_not_found");
  await prisma.meal.delete({ where: { id } });
  return c.json({ ok: true });
});
