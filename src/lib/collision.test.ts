import { describe, it, expect } from "vitest";
import { segmentCircleCollisionT } from "./collision";

describe("segmentCircleCollisionT", () => {
  it("returns null when segment does not intersect circle", () => {
    expect(segmentCircleCollisionT(0, 0, 10, 0, 50, 50, 10)).toBeNull();
  });

  it("returns t when segment passes through circle center", () => {
    const t = segmentCircleCollisionT(0, 0, 100, 0, 50, 0, 5);
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it("returns first hit (smaller t) when segment crosses circle", () => {
    const t = segmentCircleCollisionT(0, 0, 20, 0, 10, 0, 3);
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
  });

  it("returns null when segment is degenerate (zero length)", () => {
    expect(segmentCircleCollisionT(5, 5, 5, 5, 5, 5, 2)).toBeNull();
  });

  it("returns null when circle is behind segment start", () => {
    const t = segmentCircleCollisionT(20, 0, 100, 0, 10, 0, 3);
    expect(t).toBeNull();
  });

  it("returns t in [0,1] for tangent touch", () => {
    const t = segmentCircleCollisionT(0, 5, 20, 5, 10, 5, 5);
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });
});
