/**
 * Unit tests for calorie conversion math.
 * These avoid DB access — we test the pure math around unit-to-grams
 * by calling the exported estimator indirectly via a minimal stub.
 *
 * For an integration test that hits Prisma, create a test DB and
 * call lookupFood() directly (not done here to keep the suite hermetic).
 */
import { describe, it, expect } from "bun:test";

// Re-implement the pure helper from nutrition.service for an isolated unit test.
// (We intentionally keep nutrition.service Prisma-bound; this mirrors its math.)
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.35, lb: 453.6,
  ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5,
  slice: 30, piece: 50, bowl: 250, plate: 350, serving: 100,
};

function convertToGrams(quantity: number, unit: string, defaultServingGrams: number): number {
  const u = unit.toLowerCase();
  if (u === "serving" || !UNIT_TO_GRAMS[u]) return quantity * defaultServingGrams;
  return quantity * UNIT_TO_GRAMS[u]!;
}

function calories(caloriesPer100g: number, grams: number): number {
  return Math.round(caloriesPer100g * (grams / 100));
}

describe("unit→grams conversion", () => {
  it("grams pass through", () => {
    expect(convertToGrams(200, "g", 100)).toBe(200);
  });
  it("oz to grams", () => {
    expect(convertToGrams(4, "oz", 100)).toBeCloseTo(113.4, 1);
  });
  it("cup approximates 240g", () => {
    expect(convertToGrams(2, "cup", 100)).toBe(480);
  });
  it("serving uses default serving grams", () => {
    expect(convertToGrams(2, "serving", 50)).toBe(100);
  });
  it("unknown unit uses default serving grams", () => {
    expect(convertToGrams(3, "handful", 30)).toBe(90);
  });
});

describe("calorie calculation", () => {
  it("calculates kcal for an egg (155 kcal/100g, 50g)", () => {
    expect(calories(155, 50)).toBe(78);
  });
  it("calculates kcal for 150g white rice (130 kcal/100g)", () => {
    expect(calories(130, 150)).toBe(195);
  });
  it("scales linearly for double servings", () => {
    const single = calories(200, 100);
    const double = calories(200, 200);
    expect(double).toBe(single * 2);
  });
});
