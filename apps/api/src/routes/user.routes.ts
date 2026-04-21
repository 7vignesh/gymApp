import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma, ActivityLevel, GoalType, Sex } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { applyAdaptiveGoals, computeAdaptiveGoals } from "../services/goal.service";

export const userRoutes = new Hono<AuthContext>();
userRoutes.use("*", requireAuth);

/** Manual macro-goal override. */
const GoalsSchema = z.object({
  dailyCalorieGoal: z.number().int().min(800).max(8000).optional(),
  dailyProteinGoal: z.number().int().min(0).max(500).optional(),
  dailyCarbsGoal:   z.number().int().min(0).max(1000).optional(),
  dailyFatGoal:     z.number().int().min(0).max(400).optional(),
});

userRoutes.patch("/goals", zValidator("json", GoalsSchema), async (c) => {
  const userId = c.get("userId");
  const updates = c.req.valid("json");
  const user = await prisma.user.update({ where: { id: userId }, data: updates });
  return c.json({ user });
});

/** Adaptive-goals profile (height, age, sex, activity, goal type). */
const ProfileSchema = z.object({
  heightCm: z.number().min(100).max(250).optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 5).optional(),
  sex: z.nativeEnum(Sex).optional(),
  activityLevel: z.nativeEnum(ActivityLevel).optional(),
  goalType: z.nativeEnum(GoalType).optional(),
  targetWeightKg: z.number().min(20).max(400).optional(),
  currentWeightKg: z.number().min(20).max(400).optional(),
});

userRoutes.patch("/profile", zValidator("json", ProfileSchema), async (c) => {
  const userId = c.get("userId");
  const updates = c.req.valid("json");
  const user = await prisma.user.update({ where: { id: userId }, data: updates });
  return c.json({ user });
});

/** GET preview (no write). */
userRoutes.get("/goals/preview", async (c) => {
  const userId = c.get("userId");
  const adaptation = await computeAdaptiveGoals(userId);
  return c.json(adaptation);
});

/** POST apply — adapt + persist. */
userRoutes.post("/goals/adapt", async (c) => {
  const userId = c.get("userId");
  const adaptation = await applyAdaptiveGoals(userId);
  return c.json(adaptation);
});

/** Muscle-group preferences (Personalized Exercise Library onboarding). */
const MUSCLE_GROUPS = [
  "biceps",
  "triceps",
  "back",
  "chest",
  "shoulders",
  "legs",
  "core",
  "forearms",
  "full body",
] as const;

const MusclePrefSchema = z.object({
  muscleGroups: z.array(z.enum(MUSCLE_GROUPS)).max(MUSCLE_GROUPS.length),
});

userRoutes.get("/muscle-preferences", async (c) => {
  const userId = c.get("userId");
  const pref = await prisma.userMusclePreference.findUnique({ where: { userId } });
  return c.json({ preference: pref });
});

userRoutes.put(
  "/muscle-preferences",
  zValidator("json", MusclePrefSchema),
  async (c) => {
    const userId = c.get("userId");
    const { muscleGroups } = c.req.valid("json");
    const pref = await prisma.userMusclePreference.upsert({
      where: { userId },
      create: { userId, muscleGroups },
      update: { muscleGroups },
    });
    return c.json({ preference: pref });
  },
);
