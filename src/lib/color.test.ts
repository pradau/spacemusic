import { describe, it, expect } from "vitest";
import { hexToRgb, pulseColor } from "./color";

describe("hexToRgb", () => {
  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("parses white", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("parses red", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
  });

  it("parses a hex color", () => {
    expect(hexToRgb("#5b9bd5")).toEqual([91, 155, 213]);
  });
});

describe("pulseColor", () => {
  it("returns same color when amount is 0", () => {
    expect(pulseColor("#5b9bd5", 0)).toBe("rgb(91,155,213)");
  });

  it("returns white when amount is 1", () => {
    expect(pulseColor("#5b9bd5", 1)).toBe("rgb(255,255,255)");
  });

  it("returns brighter color when amount is between 0 and 1", () => {
    const result = pulseColor("#000000", 0.5);
    expect(result).toBe("rgb(128,128,128)");
  });
});
