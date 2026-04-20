/**
 * NLP food parser.
 *
 * Takes free-text like "2 eggs and a bowl of rice with 200g chicken"
 * and returns structured food items: { name, quantity, unit }[].
 *
 * Strategy:
 *   1) Split on conjunctions (",", "and", "with", "plus", "&").
 *   2) For each chunk, extract:
 *      - quantity   (numeric, with unicode-fraction support: "½")
 *      - unit       (g, oz, cup, slice, bowl, etc.)
 *      - food name  (remaining tokens, minus stop-words)
 *   3) Return a ParsedFood[].
 *
 * This parser is intentionally dependency-free — deterministic, testable,
 * and fast. The AI food parser (see ai.service.ts) can be used as a
 * fallback for ambiguous/complex inputs.
 */

export interface ParsedFood {
  name: string;
  quantity: number;
  unit: string;
  raw: string;
}

const SPLIT_REGEX = /\s*(?:,|\band\b|\bwith\b|\bplus\b|&|\+)\s*/i;

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", liter: "l", liters: "l",
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  slice: "slice", slices: "slice",
  piece: "piece", pieces: "piece",
  bowl: "bowl", bowls: "bowl",
  plate: "plate", plates: "plate",
  serving: "serving", servings: "serving",
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 0.33, "⅔": 0.67, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 0.167, "⅚": 0.833, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "some", "my", "piece", "bowl", "plate", "serving",
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25,
};

/** Parse a leading quantity token ("2", "1.5", "1/2", "½"). Returns `null` if not numeric. */
function parseLeadingQuantity(token: string): number | null {
  if (!token) return null;
  if (UNICODE_FRACTIONS[token] !== undefined) return UNICODE_FRACTIONS[token]!;
  if (NUMBER_WORDS[token.toLowerCase()] !== undefined) return NUMBER_WORDS[token.toLowerCase()]!;
  const frac = /^(\d+)\/(\d+)$/.exec(token);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    return b === 0 ? null : a / b;
  }
  // "200g" style — number with trailing unit glued on
  const glued = /^(\d+(?:\.\d+)?)([a-zA-Z]+)$/.exec(token);
  if (glued) return Number(glued[1]);
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

/** Detect if a token glues unit to a number like "200g". Returns unit or null. */
function gluedUnit(token: string): string | null {
  const m = /^\d+(?:\.\d+)?([a-zA-Z]+)$/.exec(token);
  if (!m) return null;
  const unit = m[1]!.toLowerCase();
  return UNIT_ALIASES[unit] ?? null;
}

/** Parse a single chunk like "2 eggs" or "200g chicken breast". */
export function parseChunk(input: string): ParsedFood | null {
  const raw = input.trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/);
  let idx = 0;
  let quantity = 1;
  let unit = "serving";

  // Skip leading articles ("a", "an", "the", "some", "my") so they don't
  // occupy the quantity slot.
  const LEADING_ARTICLES = new Set(["a", "an", "the", "some", "my"]);
  while (idx < tokens.length && LEADING_ARTICLES.has(tokens[idx]!.toLowerCase())) {
    idx++;
  }

  // Step 1: leading quantity
  const first = tokens[idx];
  const q = first ? parseLeadingQuantity(first) : null;
  if (q !== null) {
    quantity = q;
    // If it's "200g" style, extract glued unit.
    const glued = first ? gluedUnit(first) : null;
    if (glued) unit = glued;
    idx++;
  }

  // Step 2: next token as unit?
  const next = tokens[idx]?.toLowerCase();
  if (next && UNIT_ALIASES[next]) {
    unit = UNIT_ALIASES[next]!;
    idx++;
  }

  // Step 3: remaining tokens = food name (strip stop words)
  const nameTokens = tokens.slice(idx).filter((t) => !STOP_WORDS.has(t.toLowerCase()));
  const name = nameTokens.join(" ").trim().toLowerCase();

  if (!name) return null;
  return { name, quantity, unit, raw };
}

/** Parse a full user input like "2 eggs and rice with 200g chicken". */
export function parseFoodText(input: string): ParsedFood[] {
  if (!input || !input.trim()) return [];
  return input
    .split(SPLIT_REGEX)
    .map((chunk) => parseChunk(chunk))
    .filter((x): x is ParsedFood => x !== null);
}
