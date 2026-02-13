/**
 * Color helpers for instrument pulse visualization.
 */

/** Parse hex color "#rrggbb" to [r, g, b] in 0..255. */
export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Lerp base hex color toward white by amount (0 = no change, 1 = white). Returns rgb(...) string. */
export function pulseColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const r2 = Math.round(r + (255 - r) * amount);
  const g2 = Math.round(g + (255 - g) * amount);
  const b2 = Math.round(b + (255 - b) * amount);
  return `rgb(${r2},${g2},${b2})`;
}
