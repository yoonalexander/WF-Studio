import type { Curve, View } from "./graph-render";

type Point = { x: number; value: number; branch: string };

// Keep the regular grid, then refine only intervals whose visible geometry
// needs more detail. The evaluator's own expression limits remain unchanged.
export function sampleCurve(
  id: string,
  sample: (x: number) => { value: number; branch: string },
  view: View,
  count: number,
  height: number,
): Curve {
  const baseCount = Math.max(2, Math.min(1800, Math.round(count)));
  const base = Array.from({ length: baseCount }, (_, i): Point => {
    const x = view.start + (i / (baseCount - 1)) * view.span;
    return { x, ...sample(x) };
  });
  const points = [base[0]];
  let remaining = 12000 - baseCount;
  const pixels = Math.max(100, height);
  const project = (y: number) =>
    Math.max(
      -2,
      Math.min(3, 0.5 - (y - view.yCenter) / Math.max(1e-12, view.ySpan)),
    );
  const refine = (a: Point, b: Point, depth: number) => {
    const x = a.x / 2 + b.x / 2;
    if (
      depth >= 14 ||
      remaining <= 0 ||
      x === a.x ||
      x === b.x ||
      view.span === 0
    ) {
      points.push(b);
      return;
    }
    remaining--;
    const mid: Point = { x, ...sample(x) };
    const finite = [a.value, mid.value, b.value].map(Number.isFinite);
    const boundary = a.branch !== mid.branch || mid.branch !== b.branch;
    const gap = finite.some(Boolean) && !finite.every(Boolean);
    const bends =
      finite.every(Boolean) &&
      (Math.abs(
        project(mid.value) - (project(a.value) + project(b.value)) / 2,
      ) *
        pixels >
        0.5 ||
        Math.abs(project(a.value) - project(b.value)) > 0.25);
    if (boundary || gap || bends) {
      refine(a, mid, depth + 1);
      refine(mid, b, depth + 1);
    } else points.push(b);
  };
  for (let i = 1; i < base.length; i++) refine(base[i - 1], base[i], 0);
  return {
    id,
    start: view.start,
    span: view.span,
    positions: Float64Array.from(points, (p) => p.x),
    values: Float32Array.from(points, (p) => p.value),
    breaks: Uint8Array.from(points, (p, i) =>
      Number(i > 0 && p.branch !== points[i - 1].branch),
    ),
  };
}
