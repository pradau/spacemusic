/**
 * Transpose a note name by semitones (e.g. "C4" + 2 => "D4").
 * Supports sharps only in note names (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).
 *
 * @param note - Scientific pitch notation (e.g. "C4", "F#3").
 * @param semitones - Number of semitones to add (negative to go down).
 * @returns Transposed note name, or the original string if not a valid note.
 */
export function transposeNote(note: string, semitones: number): string {
  const match = note.match(/^([A-G]#?)(\d+)$/);
  if (!match) return note;
  const chroma: Record<string, number> = {
    C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
  };
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const oct = parseInt(match[2]!, 10);
  let c = (chroma[match[1]!] ?? 0) + semitones;
  let octOffset = 0;
  while (c < 0) {
    c += 12;
    octOffset -= 1;
  }
  while (c >= 12) {
    c -= 12;
    octOffset += 1;
  }
  return names[c]! + String(oct + octOffset);
}
