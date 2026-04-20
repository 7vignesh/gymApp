/**
 * Unit tests for the rule-based food parser.
 * Run: bun test (from apps/api or root).
 */
import { describe, it, expect } from "bun:test";
import { parseFoodText, parseChunk } from "../src/services/food-parser.service";

describe("parseChunk", () => {
  it("parses simple quantity + food", () => {
    expect(parseChunk("2 eggs")).toEqual({
      name: "eggs",
      quantity: 2,
      unit: "serving",
      raw: "2 eggs",
    });
  });

  it("parses glued unit like 200g chicken", () => {
    const r = parseChunk("200g chicken breast");
    expect(r?.name).toBe("chicken breast");
    expect(r?.quantity).toBe(200);
    expect(r?.unit).toBe("g");
  });

  it("parses 'a bowl of rice' (stop-words stripped)", () => {
    const r = parseChunk("a bowl of rice");
    expect(r?.name).toBe("rice");
    expect(r?.unit).toBe("bowl");
  });

  it("parses unicode fraction ½ cup milk", () => {
    const r = parseChunk("½ cup milk");
    expect(r?.quantity).toBe(0.5);
    expect(r?.unit).toBe("cup");
    expect(r?.name).toBe("milk");
  });

  it("parses number word 'three slices of bread'", () => {
    const r = parseChunk("three slices of bread");
    expect(r?.quantity).toBe(3);
    expect(r?.unit).toBe("slice");
    expect(r?.name).toBe("bread");
  });

  it("returns null for empty input", () => {
    expect(parseChunk("")).toBeNull();
  });
});

describe("parseFoodText", () => {
  it("splits on 'and' / ',' / 'with' / '+'", () => {
    const out = parseFoodText("2 eggs and rice, with 200g chicken + 1 apple");
    expect(out.length).toBe(4);
    expect(out.map((f) => f.name)).toEqual(["eggs", "rice", "chicken", "apple"]);
  });

  it("handles empty / whitespace", () => {
    expect(parseFoodText("")).toEqual([]);
    expect(parseFoodText("   ")).toEqual([]);
  });
});
