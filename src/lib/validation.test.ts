import { describe, it, expect } from "vitest";
import { isFiniteNumber } from "./validation";

describe("isFiniteNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
  });

  it("returns false for NaN", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it("returns false for non-numbers", () => {
    expect(isFiniteNumber("1" as unknown as number)).toBe(false);
    expect(isFiniteNumber(null as unknown as number)).toBe(false);
    expect(isFiniteNumber(undefined as unknown as number)).toBe(false);
  });
});
