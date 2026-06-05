// Tiny SVG charting helpers — no chart library, keeps the bundle small.

export type Point = { x: number; y: number };

/** Map a series of values to SVG points inside a width×height viewBox. */
export function toPoints(
  values: number[],
  width: number,
  height: number,
  padX = 4,
  padY = 8,
): Point[] {
  const max = Math.max(...values, 0) || 1;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  if (values.length === 1) {
    return [{ x: width / 2, y: height - padY - (values[0] / max) * innerH }];
  }
  return values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * innerW,
    y: height - padY - (v / max) * innerH,
  }));
}

export function linePath(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

/** Closed area path from the line down to a baseline. */
export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${last.x.toFixed(2)},${baselineY} L${first.x.toFixed(2)},${baselineY} Z`;
}
