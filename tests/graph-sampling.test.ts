import { describe, it, expect } from "vitest";
import { createMathEngine } from "../src/math";
import { makeTrack } from "../src/model";
import { sampleCurve } from "../src/graph-sampling";
import { axisView } from "../src/axis-scale";

describe("asymptote detail", () => {
  it("samples both tails of every visible sine-ratio pole at the reported mobile scales", () => {
    const t = { ...makeTrack(), expression: "1.2 * sin(x / 2) / sin(1.2 * x)" };
    const engine = createMathEngine([t]);
    let calls = 0;
    const curve = sampleCurve(
      t.id,
      (x) => {
        calls++;
        return engine.sample(t.id, x);
      },
      axisView({ x: 56.64, y: 26.08 }),
      600,
      210,
    );
    expect(calls).toBeLessThanOrEqual(12000);
    expect(curve.positions!.length).toBe(curve.values.length);
    for (let k = -21; k <= 21; k++) {
      // At multiples of 12 the numerator also vanishes: these are removable holes.
      if (k % 12 === 0) continue;
      const pole = (k * Math.PI) / 1.2;
      const near = Array.from(curve.values).filter(
        (_, i) => Math.abs(curve.positions![i] - pole) < 0.1,
      );
      expect(Math.min(...near), `lower tail at ${pole}`).toBeLessThan(-26.08);
      expect(Math.max(...near), `upper tail at ${pole}`).toBeGreaterThan(26.08);
    }
    for (let i = 1; i < curve.values.length; i++) {
      expect(curve.positions![i]).toBeGreaterThan(curve.positions![i - 1]);
      const a = engine.sample(t.id, curve.positions![i - 1]);
      const b = engine.sample(t.id, curve.positions![i]);
      if (a.branch !== b.branch) expect(curve.breaks![i]).toBe(1);
    }
  });
  it("preserves bounded gaps and stops tangent paths at their actual poles", () => {
    for (const expression of [
      "tan(x)",
      "{ 1 / (x - 0.1) if x < 0.5; -x if x > 1 }",
    ]) {
      const t = { ...makeTrack(), expression };
      const engine = createMathEngine([t]);
      const curve = sampleCurve(
        t.id,
        (x) => engine.sample(t.id, x),
        axisView({ x: 4, y: 5 }),
        600,
        210,
      );
      for (let i = 1; i < curve.values.length; i++) {
        const left = engine.sample(t.id, curve.positions![i - 1]);
        const right = engine.sample(t.id, curve.positions![i]);
        if (left.branch !== right.branch) expect(curve.breaks![i]).toBe(1);
        if (expression.startsWith("{")) {
          const x = curve.positions![i];
          if (x >= 0.5 && x <= 1) expect(curve.values[i]).toBeNaN();
        }
      }
    }
  });
});
