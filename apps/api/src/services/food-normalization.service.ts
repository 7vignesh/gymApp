/**
 * Food normalization (Feature 1 — Indian Food Intelligence).
 *
 * Maps free-text like "2 plates biryani" or "masala dosa with sambar" to
 * concrete `FoodItem` rows in the DB, then derives per-portion nutrition
 * using the item's unit (plate/katori/piece/glass).
 *
 * Matching tiers:
 *   1) exact name
 *   2) substring containment in name or aliases[]
 *   3) Levenshtein ≤ 2 on the canonical name
 *   4) return null → caller falls back to FoodReference / generic engine
 *
 * Portion parsing reuses the rule-based food-parser (quantity/unit/name)
 * and then multiplies calories_per_unit by the quantity. If the user's
 * unit differs from the FoodItem's native unit (e.g. user says "grams" but
 * the item is sold "per plate"), we fall back to quantity=1 and surface a
 * low-confidence flag so the UI can prompt the user to correct.
 */
import { prisma } from "@caloriex/db";
import type { FoodItem } from "@caloriex/db";
import { parseChunk, parseFoodText, type ParsedFood } from "./food-parser.service";

export interface NormalizedFood {
  source: "food-item" | "food-reference" | "fallback";
  name: string;
  canonical: string;          // canonical DB name (lowercase)
  region?: string | null;
  cuisine?: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;         // 0..1
  matched: "exact" | "alias" | "substring" | "fuzzy" | "fallback";
  foodItemId?: string;
}

/* --------------------------- fuzzy helpers --------------------------- */

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

/** Tokens commonly prepended to Indian dishes that should be stripped
 *  when doing substring containment ("masala dosa" ⊇ "dosa"). */
const DECORATORS = new Set([
  "masala", "plain", "veg", "vegetable", "mini", "mysore",
  "butter", "tandoori", "classic", "special", "traditional",
  "hot", "spicy", "sweet", "salted", "fresh",
]);

function stripDecorators(s: string): string {
  return s
    .split(/\s+/)
    .filter((t) => !DECORATORS.has(t))
    .join(" ")
    .trim();
}

/* --------------------------- core lookup --------------------------- */

/**
 * Find the best FoodItem match for a free-text food name.
 * Returns { item, matched, confidence } or null.
 */
export async function matchFoodItem(
  rawName: string,
): Promise<{ item: FoodItem; matched: NormalizedFood["matched"]; confidence: number } | null> {
  const name = rawName.toLowerCase().trim();
  if (!name) return null;
  const stripped = stripDecorators(name);

  // 1) exact
  const exact = await prisma.foodItem.findUnique({ where: { name } });
  if (exact) return { item: exact, matched: "exact", confidence: 1 };
  if (stripped && stripped !== name) {
    const exactStripped = await prisma.foodItem.findUnique({ where: { name: stripped } });
    if (exactStripped) return { item: exactStripped, matched: "exact", confidence: 0.95 };
  }

  // 2) alias exact match
  const aliasHit = await prisma.foodItem.findFirst({ where: { aliases: { has: name } } });
  if (aliasHit) return { item: aliasHit, matched: "alias", confidence: 0.9 };

  // 3) substring / fuzzy — fetch all (table is small) and score
  const all = await prisma.foodItem.findMany();
  let bestFuzzy: { item: FoodItem; dist: number } | null = null;

  for (const item of all) {
    const candidates = [item.name, ...item.aliases];
    for (const c of candidates) {
      // substring either direction
      if (name.includes(c) || c.includes(name) || stripped.includes(c) || c.includes(stripped)) {
        return { item, matched: "substring", confidence: 0.8 };
      }
      // Levenshtein on both raw and stripped
      const d1 = levenshtein(name, c);
      const d2 = stripped ? levenshtein(stripped, c) : Infinity;
      const d = Math.min(d1, d2);
      if (!bestFuzzy || d < bestFuzzy.dist) bestFuzzy = { item, dist: d };
    }
  }

  if (bestFuzzy && bestFuzzy.dist <= 2) {
    // linear confidence: dist 0 → 0.75, dist 2 → 0.55
    const conf = Math.max(0.55, 0.75 - bestFuzzy.dist * 0.1);
    return { item: bestFuzzy.item, matched: "fuzzy", confidence: conf };
  }

  return null;
}

/* --------------------------- portion parsing --------------------------- */

/** Portion-aware quantity resolver.
 *
 *  Examples (FoodItem.unitType = "plate", calories_per_unit = 500):
 *    "2 plates biryani"      → multiplier = 2       (unit matches)
 *    "biryani"               → multiplier = 1       (default 1 plate)
 *    "half plate biryani"    → multiplier = 0.5
 *    "200g biryani"          → multiplier = 200/350 (rough: plate ≈ 350g)
 *
 *  The last case is deliberately approximate and flagged with lower
 *  confidence so the UI can ask the user to confirm.
 */
const UNIT_GRAM_ESTIMATE: Record<string, number> = {
  plate: 350,
  katori: 180,
  piece: 60,
  glass: 240,
  cup: 240,
  bowl: 250,
  slice: 30,
};

export function resolvePortion(parsed: ParsedFood, item: FoodItem): {
  multiplier: number;
  unit: string;
  approx: boolean;
} {
  const native = item.unitType.toLowerCase();
  const given = parsed.unit.toLowerCase();

  // Same unit (or caller didn't specify one — we default to "serving").
  if (given === native || given === "serving") {
    return { multiplier: parsed.quantity, unit: native, approx: false };
  }

  // Mass units → estimate portion fraction from typical weight of 1 unit.
  if (given === "g") {
    const unitGrams = UNIT_GRAM_ESTIMATE[native] ?? 200;
    return { multiplier: parsed.quantity / unitGrams, unit: native, approx: true };
  }
  if (given === "kg") {
    const unitGrams = UNIT_GRAM_ESTIMATE[native] ?? 200;
    return { multiplier: (parsed.quantity * 1000) / unitGrams, unit: native, approx: true };
  }

  // Fallback: assume user means "count of units".
  return { multiplier: parsed.quantity, unit: native, approx: true };
}

/* --------------------------- high-level API --------------------------- */

function round(n: number, d = 1): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

/** Normalize a single parsed food chunk into structured nutrition. */
export async function normalizeOne(parsed: ParsedFood): Promise<NormalizedFood | null> {
  const match = await matchFoodItem(parsed.name);
  if (!match) return null;

  const { item, matched, confidence } = match;
  const { multiplier, unit, approx } = resolvePortion(parsed, item);

  const finalConfidence = approx ? Math.min(confidence, 0.6) : confidence;

  return {
    source: "food-item",
    name: item.name,
    canonical: item.name,
    region: item.region,
    cuisine: item.cuisine,
    quantity: round(multiplier, 2),
    unit,
    calories: round(item.caloriesPerUnit * multiplier, 0),
    protein: round(item.protein * multiplier, 1),
    carbs: round(item.carbs * multiplier, 1),
    fat: round(item.fat * multiplier, 1),
    confidence: finalConfidence,
    matched,
    foodItemId: item.id,
  };
}

/** Normalize a full free-text meal description. */
export async function normalizeText(text: string): Promise<NormalizedFood[]> {
  const parsed = parseFoodText(text);
  const out: NormalizedFood[] = [];
  for (const p of parsed) {
    const n = await normalizeOne(p);
    if (n) out.push(n);
  }
  return out;
}

/** Useful for Search-as-you-type in the UI. */
export async function searchFoods(q: string, limit = 10): Promise<FoodItem[]> {
  const query = q.toLowerCase().trim();
  if (!query) return [];
  // Postgres: case-insensitive contains on name + aliases-any-of.
  return prisma.foodItem.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { aliases: { has: query } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
  });
}

// Re-export the single-chunk parser so callers can do a one-liner test.
export { parseChunk };
