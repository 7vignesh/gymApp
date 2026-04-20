/**
 * AI routes:
 *   POST /ai/parse-text   → parse free text into structured food items
 *                           (fast rule-based; falls back to LLM if unsure)
 *   POST /ai/recognize    → accept image (base64 data-URL or URL) → items
 *   GET  /ai/insights     → daily insights (cached per-day)
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { parseFoodText } from "../services/food-parser.service";
import { estimateNutrition, estimateNutritionAll } from "../services/nutrition.service";
import {
  aiEnabled,
  parseFoodWithLLM,
  recognizeFoodFromImage,
} from "../services/ai.service";
import { dailyInsightsForUser } from "../services/insights.service";
import { normalizeOne } from "../services/food-normalization.service";
import { AppError } from "../middleware/error";

export const aiRoutes = new Hono<AuthContext>();
aiRoutes.use("*", requireAuth);

/** Quick parse endpoint — returns preview of items + nutrition, does NOT persist. */
aiRoutes.post(
  "/parse-text",
  zValidator("json", z.object({ text: z.string().min(1).max(2000) })),
  async (c) => {
    const { text } = c.req.valid("json");
    const parsed = parseFoodText(text);

    // If rule-based parser produced nothing or very low confidence, try LLM.
    if (parsed.length === 0 && aiEnabled()) {
      const llm = await parseFoodWithLLM(text);
      if (llm && llm.length) {
        return c.json({
          source: "llm",
          items: llm.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            calories: i.calories ?? 0,
            protein: i.protein ?? 0,
            carbs: i.carbs ?? 0,
            fat: i.fat ?? 0,
            confidence: i.confidence,
            matched: "llm" as const,
          })),
        });
      }
    }

    const items = await estimateNutritionAll(parsed);
    return c.json({ source: "rule", items });
  },
);

/** Recognize foods from an image (base64 data-URL OR public URL). */
aiRoutes.post(
  "/recognize",
  zValidator(
    "json",
    z.object({
      image: z
        .string()
        .min(10)
        .refine(
          (v) => v.startsWith("data:image/") || v.startsWith("http"),
          "must be data-URL or http(s) URL",
        ),
    }),
  ),
  async (c) => {
    if (!aiEnabled()) {
      throw new AppError(503, "ai_not_configured");
    }
    const { image } = c.req.valid("json");
    const ai = await recognizeFoodFromImage(image);
    if (!ai || ai.length === 0) {
      return c.json({
        items: [],
        source: ai === null ? "ai_error" : "ai_empty",
        note: "No foods recognized. Try a clearer photo or add items manually.",
      });
    }

    // Map each detected item → FoodItem/FoodReference/fallback for consistent macros.
    const items = await Promise.all(
      ai.map(async (i) => {
        const parsed = {
          name: i.name.toLowerCase().trim(),
          quantity: i.quantity ?? 1,
          unit: (i.unit ?? "serving").toLowerCase(),
          raw: i.name,
        };
        // Prefer FoodItem match (Indian intelligence).
        const normalized = await normalizeOne(parsed);
        if (normalized) {
          return {
            source: "food-item" as const,
            food: normalized.name,
            canonical: normalized.canonical,
            region: normalized.region,
            quantity: normalized.quantity,
            unit: normalized.unit,
            calories: normalized.calories,
            protein: normalized.protein,
            carbs: normalized.carbs,
            fat: normalized.fat,
            confidence: Math.min(i.confidence ?? 0.5, normalized.confidence),
            matched: normalized.matched,
          };
        }

        // Fall back to per-100g generic engine. If that too fails it returns
        // a keyword-class fallback (never throws).
        const n = await estimateNutrition(parsed);
        return {
          source: "nutrition-engine" as const,
          food: n.name,
          canonical: n.name,
          region: null as string | null,
          quantity: n.quantity,
          unit: n.unit,
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          confidence: Math.min(i.confidence ?? 0.5, n.confidence),
          matched: n.matched,
        };
      }),
    );

    return c.json({ items, source: "ai" });
  },
);

aiRoutes.get("/insights", async (c) => {
  const userId = c.get("userId");
  const dateParam = c.req.query("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  const insights = await dailyInsightsForUser(userId, date);
  return c.json({ insights, aiEnabled: aiEnabled() });
});
