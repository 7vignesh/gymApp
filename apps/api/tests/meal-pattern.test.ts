/**
 * Pure-function tests for meal-pattern signature + time-of-day classification.
 * No DB dependency.
 */
import { describe, it, expect } from "bun:test";
import { signatureFor, classifyTimeOfDay } from "../src/services/meal-pattern.service";

describe("signatureFor", () => {
  it("is order-independent", () => {
    expect(signatureFor([{ name: "dosa" }, { name: "chai" }]))
      .toBe(signatureFor([{ name: "chai" }, { name: "dosa" }]));
  });

  it("lowercases and trims", () => {
    expect(signatureFor([{ name: " Dosa " }, { name: "CHAI" }]))
      .toBe("chai|dosa");
  });

  it("empty array returns empty string", () => {
    expect(signatureFor([])).toBe("");
  });
});

describe("classifyTimeOfDay", () => {
  const at = (h: number) => new Date(2026, 0, 1, h, 30, 0);

  it("06:30 → MORNING", () => { expect(classifyTimeOfDay(at(6))).toBe("MORNING"); });
  it("13:30 → MIDDAY",  () => { expect(classifyTimeOfDay(at(13))).toBe("MIDDAY"); });
  it("18:30 → EVENING", () => { expect(classifyTimeOfDay(at(18))).toBe("EVENING"); });
  it("23:30 → NIGHT",   () => { expect(classifyTimeOfDay(at(23))).toBe("NIGHT"); });
  it("02:30 → NIGHT",   () => { expect(classifyTimeOfDay(at(2))).toBe("NIGHT"); });
});
