/**
 * Food routes — Feature 1 (Indian food intelligence).
 *   GET  /foods/search?q=dosa         fuzzy search in FoodItem
 *   GET  /foods/:id                   fetch one FoodItem
 *   POST /foods/normalize             { text } → NormalizedFood[]
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { normalizeText, searchFoods } from "../services/food-normalization.service";
import { AppError } from "../middleware/error";

export const foodsRoutes = new Hono<AuthContext>();
foodsRoutes.use("*", requireAuth);

foodsRoutes.get(
  "/search",
  zValidator(
    "query",
    z.object({
      q: z.string().min(1).max(64),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  ),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    const items = await searchFoods(q, limit);
    return c.json({ items });
  },
);

foodsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const item = await prisma.foodItem.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "food_item_not_found");
  return c.json({ item });
});

foodsRoutes.post(
  "/normalize",
  zValidator("json", z.object({ text: z.string().min(1).max(2000) })),
  async (c) => {
    const { text } = c.req.valid("json");
    const items = await normalizeText(text);
    return c.json({ items });
  },
);
