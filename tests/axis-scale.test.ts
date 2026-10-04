import { describe, it, expect } from "vitest";
import { drawGraph } from "../src/graph-render";
import { axisView } from "../src/axis-scale";
import { newSimpleSong } from "../src/simple";

describe("scaled graph rendering", () => {
  const context = () => {
    const points: [number, number][] = [];
    const lines: [number, number][] = [];
    const ctx = new Proxy(
      { lineWidth: 1 },
      {
        get(target, key) {
          if (key in target) return target[key as keyof typeof target];
          if (key === "moveTo" || key === "lineTo")
            return (x: number, y: number) => {
              expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
              if (target.lineWidth === 1.8) points.push([x, y]);
              if (target.lineWidth === 1.8 && key === "lineTo")
                lines.push([x, y]);
            };
          return () => {};
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, points, lines };
  };
  it("keeps old samples at their actual x coordinates while a new scale is sampled", () => {
    const { ctx, points } = context();
    const p = newSimpleSong();
    drawGraph(
      ctx,
      874,
      470,
      p,
      [
        {
          id: p.tracks[0].id,
          values: Float32Array.of(-4, 0, 4),
          start: -4,
          span: 8,
        },
      ],
      axisView({ x: 8, y: 5 }),
      0,
      false,
      "",
      true,
      [],
      [],
      true,
      "light",
    );
    expect(points).toEqual([
      [230.5, 399],
      [437, 235],
      [643.5, 71],
    ]);
  });
  it("lets steep continuous adaptive segments reach the canvas clip instead of discarding them", () => {
    const { ctx, lines } = context();
    const p = newSimpleSong();
    drawGraph(
      ctx,
      874,
      470,
      p,
      [
        {
          id: p.tracks[0].id,
          positions: Float64Array.of(-4, 1, 4),
          values: Float32Array.of(-5e6, 0, 3e6),
        },
      ],
      axisView({ x: 4, y: 5 }),
      0,
      false,
      "",
      true,
      [],
      [],
      true,
      "light",
    );
    expect(lines).toHaveLength(2);
  });
  it("shows finite axes at zero without drawing a fabricated curve", () => {
    for (const scale of [
      { x: 0, y: 5 },
      { x: 4, y: 0 },
      { x: 0, y: 0 },
    ]) {
      const { ctx, points } = context();
      const p = newSimpleSong();
      drawGraph(
        ctx,
        874,
        470,
        p,
        [{ id: p.tracks[0].id, values: Float32Array.of(-4, 0, 4) }],
        axisView(scale),
        0,
        false,
        "",
        true,
        [],
        [],
        true,
        "light",
      );
      expect(points).toEqual([]);
    }
  });
});
