/**
 * Segment-circle collision for puck-instrument hit detection.
 */

/**
 * First t in [0,1] where segment from (x0,y0) to (x1,y1) intersects circle (cx,cy,r), or null.
 */
export function segmentCircleCollisionT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const ux = x0 - cx;
  const uy = y0 - cy;
  const a = vx * vx + vy * vy;
  if (a < 1e-10) return null;
  const b = 2 * (ux * vx + uy * vy);
  const c = ux * ux + uy * uy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  const tFirst = t1 <= t2 ? t1 : t2;
  const tSecond = t1 <= t2 ? t2 : t1;
  if (tFirst >= 0 && tFirst <= 1) return tFirst;
  if (tSecond >= 0 && tSecond <= 1) return tSecond;
  return null;
}
