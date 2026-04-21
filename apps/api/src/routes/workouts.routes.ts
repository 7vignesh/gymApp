/**
 * Workouts — minimal set/rep tracker used by the "Add to Workout" flow.
 *
 *   GET    /workouts                     — list the user's workouts
 *   POST   /workouts                     — create a workout
 *   GET    /workouts/:id                 — detail with ordered entries
 *   POST   /workouts/:id/exercises       — append an exercise entry
 *   DELETE /workouts/:id                 — delete
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { AppError } from "../middleware/error";

export const workoutsRoutes = new Hono<AuthContext>();
workoutsRoutes.use("*", requireAuth);

workoutsRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const workouts = await prisma.workout.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true } } },
    take: 50,
  });
  return c.json({ workouts });
});

const CreateWorkout = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(2000).optional(),
});
workoutsRoutes.post("/", zValidator("json", CreateWorkout), async (c) => {
  const userId = c.get("userId");
  const { name, notes } = c.req.valid("json");
  const workout = await prisma.workout.create({ data: { userId, name, notes } });
  return c.json({ workout }, 201);
});

workoutsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    include: {
      entries: { orderBy: { order: "asc" }, include: { exercise: true } },
    },
  });
  if (!workout) throw new AppError(404, "workout_not_found");
  return c.json({ workout });
});

const AddEntry = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20).default(3),
  reps: z.number().int().min(1).max(100).default(10),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  restSec: z.number().int().min(0).max(600).default(60),
  notes: z.string().max(500).optional(),
});
workoutsRoutes.post(
  "/:id/exercises",
  zValidator("json", AddEntry),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const workout = await prisma.workout.findFirst({ where: { id, userId } });
    if (!workout) throw new AppError(404, "workout_not_found");

    const ex = await prisma.exercise.findUnique({ where: { id: data.exerciseId } });
    if (!ex) throw new AppError(404, "exercise_not_found");

    const last = await prisma.workoutExercise.findFirst({
      where: { workoutId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const entry = await prisma.workoutExercise.create({
      data: {
        workoutId: id,
        exerciseId: data.exerciseId,
        order: (last?.order ?? -1) + 1,
        sets: data.sets,
        reps: data.reps,
        weightKg: data.weightKg ?? null,
        restSec: data.restSec,
        notes: data.notes,
      },
      include: { exercise: true },
    });
    return c.json({ entry }, 201);
  },
);

workoutsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const found = await prisma.workout.findFirst({ where: { id, userId } });
  if (!found) throw new AppError(404, "workout_not_found");
  await prisma.workout.delete({ where: { id } });
  return c.json({ ok: true });
});
