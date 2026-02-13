/**
 * Simple validation helpers.
 */

export function isFiniteNumber(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
}
