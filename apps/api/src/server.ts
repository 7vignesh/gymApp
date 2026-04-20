/**
 * CalAI API — Bun + Hono
 *
 * Start: bun dev (from repo root, filters to this app via turbo)
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env";
import { authRoutes } from "./routes/auth.routes";
import { mealsRoutes } from "./routes/meals.routes";
import { aiRoutes } from "./routes/ai.routes";
import { userRoutes } from "./routes/user.routes";
import { analyticsRoutes } from "./routes/analytics.routes";
import { foodsRoutes } from "./routes/foods.routes";
import { mealPatternsRoutes } from "./routes/meal-patterns.routes";
import { weightRoutes } from "./routes/weight.routes";
import { errorHandler } from "./middleware/error";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [env.WEB_URL],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) => c.json({ name: "calai-api", status: "ok" }));
app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.route("/auth", authRoutes);
app.route("/user", userRoutes);
app.route("/meals", mealsRoutes);
app.route("/meal-patterns", mealPatternsRoutes);
app.route("/foods", foodsRoutes);
app.route("/ai", aiRoutes);
app.route("/analytics", analyticsRoutes);
app.route("/weight", weightRoutes);

app.onError(errorHandler);
app.notFound((c) => c.json({ error: "not_found" }, 404));

console.log(`🚀 CalAI API running on http://localhost:${env.API_PORT}`);

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
