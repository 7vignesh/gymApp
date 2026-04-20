/**
 * Pure-function tests for adaptive goal math.
 */
import { describe, it, expect } from "bun:test";
import {
  bmrMifflinStJeor,
  macrosFor,
  analyzeWeightTrend,
} from "../src/services/goal.service";

describe("Mifflin–St Jeor BMR", () => {
  it("male 30y 180cm 80kg ~1780", () => {
    expect(bmrMifflinStJeor({
      weightKg: 80, heightCm: 180, age: 30, sex: "MALE",
    })).toBe(1780);
  });
  it("female 30y 165cm 60kg ~1320", () => {
    expect(bmrMifflinStJeor({
      weightKg: 60, heightCm: 165, age: 30, sex: "FEMALE",
    })).toBe(1320);
  });
});

describe("macrosFor", () => {
  it("distributes 2000 kcal as 25/45/30", () => {
    const m = macrosFor(2000);
    expect(m.calories).toBe(2000);
    // 25% of 2000 = 500 kcal → 125 g
    expect(m.protein).toBe(125);
    // 45% of 2000 = 900 kcal → 225 g
    expect(m.carbs).toBe(225);
    // 30% of 2000 = 600 kcal → 67 g (rounded)
    expect(m.fat).toBe(67);
  });
});

describe("analyzeWeightTrend", () => {
  it("detects a 1 kg/wk loss", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const logs = Array.from({ length: 14 }, (_, i) => ({
      id: `${i}`,
      userId: "u",
      weightKg: 80 - i * (1 / 7),   // 1 kg/wk loss
      note: null,
      loggedAt: new Date(base + i * 86400000),
    }));
    const trend = analyzeWeightTrend(logs);
    expect(trend.slopeKgPerWeek).toBeCloseTo(-1, 1);
    expect(trend.latestWeightKg).toBeCloseTo(80 - 13 / 7, 2);
    expect(trend.daysOfData).toBeGreaterThanOrEqual(13);
  });

  it("empty logs → null slope", () => {
    const t = analyzeWeightTrend([]);
    expect(t.slopeKgPerWeek).toBeNull();
    expect(t.latestWeightKg).toBeNull();
  });
});
