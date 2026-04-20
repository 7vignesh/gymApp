/**
 * Nutrition engine — converts parsed foods into calorie/macro estimates.
 *
 * Lookup order:
 *   1) Exact match in FoodReference (by name).
 *   2) Alias match in FoodReference.aliases[].
 *   3) Fuzzy match (contains / Levenshtein ≤ 2) on known names.
 *   4) Fallback: generic estimate by keyword class (veg/protein/carb/unknown).
 *
 * All macros are stored per-100g; we multiply by servingGrams / 100.
 */
import { prisma } from "@calai/db";
import type { ParsedFood } from "./food-parser.service";
import { normalizeOne } from "./food-normalization.service";

export interface NutritionResult {
  name: string;
  quantity: number;
  unit: string;
  gramsConsumed: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  matched: "exact" | "alias" | "fuzzy" | "fallback";
  confidence: number;
}

// Approximate weight (grams) for non-mass units. Conservative averages.
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1, kg: 1000,
  oz: 28.35, lb: 453.6,
  ml: 1, l: 1000, // ~water density, rough
  cup: 240,
  tbsp: 15, tsp: 5,
  slice: 30, piece: 50, bowl: 250, plate: 350, serving: 100,
};

function convertToGrams(quantity: number, unit: string, defaultServingGrams: number): number {
  const u = unit.toLowerCase();
  if (u === "serving" || !UNIT_TO_GRAMS[u]) {
    return quantity * defaultServingGrams;
  }
  return quantity * UNIT_TO_GRAMS[u]!;
}

/** Cheap Levenshtein distance for short food names. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[n]!;
}

interface FoodRef {
  id: string; name: string; aliases: string[];
  caloriesPer100g: number; proteinPer100g: number;
  carbsPer100g: number; fatPer100g: number;
  defaultServingGrams: number;
}

/** Fallback macro table by category keyword. */
const FALLBACK = {
  veg:     { cals: 40,  p: 2,  c: 8,  f: 0.3, serving: 150 },
  fruit:   { cals: 60,  p: 0.7,c: 15, f: 0.2, serving: 150 },
  protein: { cals: 180, p: 25, c: 0,  f: 8,   serving: 120 },
  carb:    { cals: 250, p: 7,  c: 50, f: 2,   serving: 120 },
  fat:     { cals: 600, p: 7,  c: 5,  f: 60,  serving: 20  },
  default: { cals: 150, p: 5,  c: 20, f: 5,   serving: 100 },
} as const;

const CATEGORY_KEYWORDS: Record<keyof typeof FALLBACK, string[]> = {
  veg: ["lettuce", "spinach", "broccoli", "carrot", "salad", "cucumber", "tomato"],
  fruit: ["apple", "banana", "orange", "berry", "mango", "grape", "fruit"],
  protein: ["chicken", "beef", "pork", "fish", "tofu", "egg", "tuna", "turkey", "shrimp"],
  carb: ["rice", "bread", "pasta", "noodle", "potato", "oat", "cereal", "tortilla"],
  fat: ["butter", "oil", "cheese", "cream", "mayo", "avocado"],
  default: [],
};

function classify(name: string): keyof typeof FALLBACK {
  const n = name.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === "default") continue;
    if (words.some((w) => n.includes(w))) return cat as keyof typeof FALLBACK;
  }
  return "default";
}

/** Look up a food in the reference DB, trying exact -> alias -> fuzzy. */
export async function lookupFood(name: string): Promise<{ ref: FoodRef; matched: NutritionResult["matched"]; confidence: number } | null> {
  const lower = name.toLowerCase().trim();

  // 1. exact name
  const exact = await prisma.foodReference.findUnique({ where: { name: lower } });
  if (exact) return { ref: exact, matched: "exact", confidence: 1 };

  // 2. alias
  const alias = await prisma.foodReference.findFirst({ where: { aliases: { has: lower } } });
  if (alias) return { ref: alias, matched: "alias", confidence: 0.9 };

  // 3. fuzzy — fetch all (table is small) and score
  const all = await prisma.foodReference.findMany();
  let best: { ref: FoodRef; dist: number } | null = null;
  for (const ref of all) {
    const candidates = [ref.name, ...ref.aliases];
    for (const c of candidates) {
      if (lower.includes(c) || c.includes(lower)) {
        return { ref, matched: "fuzzy", confidence: 0.75 };
      }
      const d = levenshtein(lower, c);
      if (!best || d < best.dist) best = { ref, dist: d };
    }
  }
  if (best && best.dist <= 2) {
    return { ref: best.ref, matched: "fuzzy", confidence: 0.6 };
  }

  return null;
}

/** Resolve a single ParsedFood into nutrition macros.
 *
 *  Tier priority:
 *    1) FoodItem (per-unit, e.g. "1 plate biryani") — Feature 1
 *    2) FoodReference (per-100g, generic)
 *    3) Keyword-class fallback
 */
export async function estimateNutrition(food: ParsedFood): Promise<NutritionResult> {
  // Tier 1: rich per-unit FoodItem (Indian intelligence)
  const normalized = await normalizeOne(food);
  if (normalized) {
    return {
      name: normalized.name,
      quantity: normalized.quantity,
      unit: normalized.unit,
      gramsConsumed: 0, // not meaningful for per-unit items
      calories: normalized.calories,
      protein: normalized.protein,
      carbs: normalized.carbs,
      fat: normalized.fat,
      matched: normalized.matched === "substring" ? "fuzzy" : normalized.matched === "exact" || normalized.matched === "alias" || normalized.matched === "fuzzy" ? normalized.matched : "fuzzy",
      confidence: normalized.confidence,
    };
  }

  const hit = await lookupFood(food.name);
  if (hit) {
    const { ref, matched, confidence } = hit;
    const grams = convertToGrams(food.quantity, food.unit, ref.defaultServingGrams);
    const factor = grams / 100;
    return {
      name: ref.name,
      quantity: food.quantity,
      unit: food.unit,
      gramsConsumed: round(grams, 1),
      calories: round(ref.caloriesPer100g * factor),
      protein: round(ref.proteinPer100g * factor, 1),
      carbs: round(ref.carbsPer100g * factor, 1),
      fat: round(ref.fatPer100g * factor, 1),
      matched,
      confidence,
    };
  }

  // Fallback by category classification.
  const cat = classify(food.name);
  const f = FALLBACK[cat];
  const grams = convertToGrams(food.quantity, food.unit, f.serving);
  const factor = grams / 100;
  return {
    name: food.name,
    quantity: food.quantity,
    unit: food.unit,
    gramsConsumed: round(grams, 1),
    calories: round(f.cals * factor),
    protein: round(f.p * factor, 1),
    carbs: round(f.c * factor, 1),
    fat: round(f.f * factor, 1),
    matched: "fallback",
    confidence: 0.3,
  };
}

/** Estimate nutrition for multiple parsed foods, preserving order. */
export async function estimateNutritionAll(foods: ParsedFood[]): Promise<NutritionResult[]> {
  return Promise.all(foods.map((f) => estimateNutrition(f)));
}

function round(n: number, decimals = 0): number {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}
