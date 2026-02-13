import { describe, it, expect } from "vitest";
import { transposeNote } from "./transpose";

describe("transposeNote", () => {
  it("returns same note when semitones is 0", () => {
    expect(transposeNote("C4", 0)).toBe("C4");
    expect(transposeNote("F#3", 0)).toBe("F#3");
  });

  it("transposes up by positive semitones", () => {
    expect(transposeNote("C4", 1)).toBe("C#4");
    expect(transposeNote("C4", 2)).toBe("D4");
    expect(transposeNote("C4", 12)).toBe("C5");
    expect(transposeNote("A4", 3)).toBe("C5");
    expect(transposeNote("G4", 2)).toBe("A4");
  });

  it("transposes down by negative semitones", () => {
    expect(transposeNote("D4", -1)).toBe("C#4");
    expect(transposeNote("D4", -2)).toBe("C4");
    expect(transposeNote("C4", -12)).toBe("C3");
    expect(transposeNote("C5", -3)).toBe("A4");
  });

  it("wraps octave when crossing boundaries", () => {
    expect(transposeNote("B4", 1)).toBe("C5");
    expect(transposeNote("C4", -1)).toBe("B3");
    expect(transposeNote("A4", 4)).toBe("C#5");
  });

  it("returns original string for invalid note format", () => {
    expect(transposeNote("invalid", 2)).toBe("invalid");
    expect(transposeNote("", 0)).toBe("");
    expect(transposeNote("H4", 0)).toBe("H4");
    expect(transposeNote("C", 0)).toBe("C");
  });
});
