/**
 * Exercise library public routes.
 *
 *   GET /exercises                      — paginated, filtered list
 *   GET /exercises/filters/meta         — available bodyParts / equipment / levels
 *   GET /exercises/:slug                — full detail
 *   GET /exercises/:slug/alternatives   — same bodyPart, different equipment
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  getAlternatives,
  getExerciseBySlug,
  getFilterMeta,
  listExercises,
} from "../services/exercise.service";
import { AppError } from "../middleware/error";

export const exercisesRoutes = new Hono();

const boolish = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

const ListQuery = z.object({
  bodyPart: z.union([z.string(), z.array(z.string())]).optional(),
  equipment: z.union([z.string(), z.array(z.string())]).optional(),
  level: z.string().optional(),
  isBodyweight: boolish,
  isMachine: boolish,
  isFreeWeight: boolish,
  isCable: boolish,
  isBands: boolish,
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["alpha", "level", "newest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

exercisesRoutes.get("/", zValidator("query", ListQuery), async (c) => {
  const q = c.req.valid("query");
  const result = await listExercises(q);
  return c.json(result);
});

// NOTE: keep this before "/:slug" so it isn't swallowed by the param route.
exercisesRoutes.get("/filters/meta", async (c) => {
  const meta = await getFilterMeta();
  return c.json(meta);
});

exercisesRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const ex = await getExerciseBySlug(slug);
  if (!ex) throw new AppError(404, "exercise_not_found");
  return c.json({ exercise: ex });
});

exercisesRoutes.get("/:slug/alternatives", async (c) => {
  const slug = c.req.param("slug");
  const out = await getAlternatives(slug);
  if (!out) throw new AppError(404, "exercise_not_found");
  return c.json(out);
});
