/**
 * Weight tracking routes (Feature 7).
 *   POST   /weight           add a weight log entry
 *   GET    /weight/history   list last N days of entries
 *   DELETE /weight/:id       remove a log
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@caloriex/db";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { addDays } from "../utils/date";

export const weightRoutes = new Hono<AuthContext>();
weightRoutes.use("*", requireAuth);

weightRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      weightKg: z.number().min(20).max(400),
      note: z.string().max(200).optional(),
      loggedAt: z.string().datetime().optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const log = await prisma.weightLog.create({
      data: {
        userId,
        weightKg: body.weightKg,
        note: body.note,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
      },
    });
    // Keep User.currentWeightKg in sync with latest entry.
    await prisma.user.update({
      where: { id: userId },
      data: { currentWeightKg: body.weightKg },
    });
    return c.json({ log }, 201);
  },
);

weightRoutes.get(
  "/history",
  zValidator(
    "query",
    z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { days } = c.req.valid("query");
    const logs = await prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: addDays(new Date(), -days) } },
      orderBy: { loggedAt: "asc" },
    });
    return c.json({ logs });
  },
);

weightRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const log = await prisma.weightLog.findFirst({ where: { id, userId } });
  if (!log) throw new AppError(404, "weight_log_not_found");
  await prisma.weightLog.delete({ where: { id } });
  return c.json({ ok: true });
});
