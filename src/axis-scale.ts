import type { View } from "./graph-render";

export interface AxisScale {
  x: number;
  y: number;
}
// Leave room for a finite doubled span; there is no preset/UI maximum.
export const scaleValue = (value: number) =>
  Number.isFinite(value)
    ? Math.min(Number.MAX_VALUE / 4, Math.max(0, value))
    : undefined;

export function axisView({ x, y }: AxisScale): View {
  return { start: -x, span: x * 2, yCenter: 0, ySpan: y * 2 };
}

export function scrollScale(value: number, delta: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  return (
    scaleValue(Number((value - (delta / 100) * step).toPrecision(12))) ?? value
  );
}
