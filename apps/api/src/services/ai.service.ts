/**
 * AI service — wraps OpenAI for:
 *   1. Vision (image → food items)
 *   2. Structured NLP fallback (text → food items)
 *   3. Insights / recommendations (daily log → suggestions)
 *
 * All functions gracefully degrade if OPENAI_API_KEY is not configured —
 * they return `null` and upstream code falls back to the deterministic
 * food-parser.service + nutrition.service.
 */
import { env } from "../env";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const VISION_MODEL = "gpt-4o-mini";
const TEXT_MODEL = "gpt-4o-mini";

export interface AIFoodItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedGrams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  confidence: number;
}

export function aiEnabled(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

async function chat(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openai_error: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

type ChatResp = { choices: { message: { content: string } }[] };

function extractJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to find a JSON block in the text.
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/** ===== Vision: image URL or base64 data-URL → food items =====
 *
 * Feature 4 — Multi-food image detection.
 *   • Prompt is explicit about returning EVERY distinct food visible.
 *   • Accepts Indian plate units (plate / katori / glass).
 *   • Returns per-item confidence; caller maps to FoodItem for
 *     culturally-correct calorie estimates.
 */
export async function recognizeFoodFromImage(
  imageDataUrlOrUrl: string,
): Promise<AIFoodItem[] | null> {
  if (!aiEnabled()) return null;

  const systemPrompt = `You are a nutrition expert specializing in global and Indian cuisine.
Identify EVERY distinct food item visible in the photo — do NOT merge separate foods
into one entry. If the photo shows a thali/plate with rice, dal, sabzi, and roti,
return FOUR items. For each item return:
  - name (lowercase, concise, prefer known dish names like "dal", "biryani", "masala dosa")
  - quantity (number, best guess)
  - unit: one of "plate" | "katori" | "piece" | "glass" | "cup" | "bowl" | "slice" | "g"
  - estimatedGrams (approximate total grams consumed)
  - calories, protein, carbs, fat (numeric, per the visible portion)
  - confidence (0..1)
Respond with ONLY a JSON object: { "items": AIFoodItem[] }. No prose.`;

  try {
    const json = (await chat({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "List every food in this image with portions." },
            { type: "image_url", image_url: { url: imageDataUrlOrUrl } },
          ],
        },
      ],
      temperature: 0.2,
    })) as ChatResp;

    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = extractJSON<{ items: AIFoodItem[] }>(content);
    if (!parsed?.items) return [];
    // Drop malformed rows.
    return parsed.items.filter(
      (i) => typeof i?.name === "string" && i.name.trim().length > 0,
    );
  } catch (e) {
    console.warn("[ai] vision call failed:", e);
    return null;
  }
}

/** ===== Structured NLP fallback (when rule-based parser is ambiguous) ===== */
export async function parseFoodWithLLM(text: string): Promise<AIFoodItem[] | null> {
  if (!aiEnabled()) return null;

  const systemPrompt = `You are a strict NLP food parser. Convert the user's meal description into
structured items. For EACH item return: name, quantity, unit (g|serving|slice|piece|cup|bowl),
estimatedGrams, calories, protein, carbs, fat, confidence (0..1).
Respond with ONLY JSON: { "items": AIFoodItem[] }.`;

  const json = (await chat({
    model: TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.1,
  })) as ChatResp;

  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = extractJSON<{ items: AIFoodItem[] }>(content);
  return parsed?.items ?? null;
}

/** ===== Daily insights / suggestions ===== */
export interface DailyLogSummary {
  date: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
  meals: { name: string; calories: number; mealType: string }[];
}

export interface Insight {
  headline: string;
  detail: string;
  severity: "info" | "warn" | "good";
}

export async function generateInsights(summary: DailyLogSummary): Promise<Insight[]> {
  // Deterministic baseline insights — work even without an API key.
  const baseline = computeBaselineInsights(summary);
  if (!aiEnabled()) return baseline;

  try {
    const systemPrompt = `You are a supportive nutrition coach. Given a user's daily intake vs. goals,
produce 2-4 short, actionable insights. Each has headline (<=60 chars), detail (<=160 chars),
and severity ("info" | "warn" | "good"). Respond with ONLY JSON: { "insights": Insight[] }.`;

    const json = (await chat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(summary) },
      ],
      temperature: 0.4,
    })) as ChatResp;

    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = extractJSON<{ insights: Insight[] }>(content);
    if (parsed?.insights?.length) return parsed.insights;
    return baseline;
  } catch (e) {
    console.warn("[ai] insight generation failed, falling back:", e);
    return baseline;
  }
}

function computeBaselineInsights(s: DailyLogSummary): Insight[] {
  const insights: Insight[] = [];
  const { totals, goals } = s;

  if (totals.calories > goals.calories * 1.1) {
    insights.push({
      headline: "Over your calorie goal",
      detail: `You've consumed ${Math.round(totals.calories)} kcal vs a ${goals.calories} kcal goal.`,
      severity: "warn",
    });
  } else if (totals.calories < goals.calories * 0.7 && s.meals.length > 1) {
    insights.push({
      headline: "Eating under your goal",
      detail: `Only ${Math.round(totals.calories)} kcal logged. Consider a balanced snack.`,
      severity: "info",
    });
  } else if (totals.calories > 0) {
    insights.push({
      headline: "On track today",
      detail: `${Math.round(totals.calories)} kcal logged — within a healthy range of your goal.`,
      severity: "good",
    });
  }

  if (totals.protein < goals.protein * 0.6 && totals.calories > 0) {
    insights.push({
      headline: "Protein intake is low",
      detail: `Only ${Math.round(totals.protein)}g of ${goals.protein}g goal. Add eggs, chicken, or Greek yogurt.`,
      severity: "warn",
    });
  }

  if (s.meals.length === 0) {
    insights.push({
      headline: "No meals logged yet",
      detail: "Log your first meal by text or a photo to get started.",
      severity: "info",
    });
  }

  return insights;
}
