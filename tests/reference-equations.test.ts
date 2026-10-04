import { describe, it, expect } from "vitest";
import katex from "katex";
import { createMathEngine, mod } from "../src/math";
import { makeTrack, newProject } from "../src/model";
import { continuousAt } from "../src/music";
import { referenceEquations } from "../src/reference-equations";
import { randomEquationFamilies } from "../src/random-equation";
import { previewExtent } from "../src/bounds";
import { fitComposition } from "../src/simple";

describe("the 25 screenshot equations", () => {
  it("preserves positive decimal modulo and expands negative bounds into view", () => {
    expect(mod(0.15, 1)).toBe(0.15);
    expect(mod(0.3569, 1)).toBe(0.3569);
    expect(mod(-0.25, 1)).toBe(0.75);
    expect(mod(3, -4)).toBe(-1);
    expect(previewExtent(referenceEquations[0].expression)).toBe(8);
    expect(previewExtent("sin(x) { -12 <= x < 11 }")).toBe(12);
    expect(previewExtent("sin(x) { x mod 16 < 1 }")).toBe(4);
    expect(previewExtent("sin(x) { x < 1000000 }")).toBe(64);
  });
  it("keeps reciprocal asymptotes visible without flattening ordinary values", () => {
    const project = newProject();
    project.tracks = [makeTrack()];
    project.loop.endBeat = 4;
    const values = Float32Array.from(
      { length: 1200 },
      (_, i) => 1 / (-4 + (i * 8) / 1199),
    );
    const view = fitComposition(
      project,
      [{ id: project.tracks[0].id, values }],
      true,
    );
    expect(view.ySpan).toBeLessThan(12);
    expect(view.yCenter - view.ySpan / 2).toBeLessThan(-2);
    expect(view.yCenter + view.ySpan / 2).toBeGreaterThan(2);
  });
  it("accounts for every supplied screenshot and includes each in Random", () => {
    expect(referenceEquations).toHaveLength(25);
    expect(new Set(referenceEquations.map((e) => e.screenshot)).size).toBe(25);
    expect(
      randomEquationFamilies
        .filter((f) => "referenceId" in f)
        .map((f) => "referenceId" in f && f.referenceId),
    ).toEqual(referenceEquations.map((e) => e.id));
  });
  it.each(referenceEquations)(
    "$id $name compiles, renders and produces finite, audible math",
    (reference) => {
      const track = {
        ...makeTrack(),
        expression: reference.expression,
        symbol: "f",
      };
      const engine = createMathEngine([track]);
      expect(engine.errors).toEqual({});
      expect(() =>
        katex.renderToString(engine.tex[track.id], { throwOnError: true }),
      ).not.toThrow();
      const project = { ...newProject(), tracks: [track] };
      const values: number[] = [];
      for (let i = 0; i <= 2048; i++) {
        const x = -16 + (i * 32) / 2053;
        const value = engine.value(track.id, x);
        const event = continuousAt(project, track, x, engine);
        if (Number.isFinite(value)) {
          values.push(value);
          expect(event?.value).toBe(value);
          expect(event!.note).toBeGreaterThanOrEqual(12);
          expect(event!.note).toBeLessThanOrEqual(108);
        } else expect(event).toBeUndefined();
      }
      expect(values.length).toBeGreaterThan(20);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0);
    },
  );
  it("matches the nested floor/absolute-value formulas algebraically", () => {
    const folded = (x: number) =>
      4 * Math.abs(x - Math.floor(x + 3 / 4) + 1 / 4) - 1;
    const expressions = [
      ["triangle(x)", folded],
      [
        referenceEquations[4].expression,
        (x: number) => 0.5 * x * folded(x) ** 2 * folded(x * folded(x)) ** 2,
      ],
      [
        referenceEquations[24].expression,
        (x: number) => 2.7 * folded(3 * folded(2 * folded(x))),
      ],
    ] as const;
    for (const [expression, expected] of expressions) {
      const track = { ...makeTrack(), expression };
      const engine = createMathEngine([track]);
      for (let i = -2048; i <= 2048; i++)
        expect(engine.value(track.id, i / 127)).toBeCloseTo(
          expected(i / 127),
          9,
        );
    }
  });
  it("preserves exact bounds, first-match ordering, pulse widths and poles", () => {
    const value = (index: number, x: number) => {
      const track = {
        ...makeTrack(),
        expression: referenceEquations[index].expression,
      };
      return createMathEngine([track]).value(track.id, x);
    };
    expect(value(0, -7.5776)).toBe(0.5);
    expect(value(0, -7.2207)).toBe(0.25);
    expect(value(0, -6.9518)).toBeNaN();
    expect(value(0, 0)).toBeNaN();
    expect(value(16, 0)).toBe(3);
    expect(value(16, 0.5)).toBe(-1.2);
    expect(value(16, 1.2)).toBeCloseTo(1.76);
    expect(value(21, 0.1499)).toBe(1.5);
    expect(value(21, 0.15)).toBe(-1.5);
    expect(value(21, 1.3999)).toBe(1.5);
    expect(value(21, 1.4001)).toBe(-1.5);
    expect(value(20, 0)).toBeNaN();
    expect(value(20, -2)).toBe(-0.5);
    expect(value(20, 2)).toBe(0.5);
    expect(value(9, 0)).toBeNaN();
    expect(value(2, 0)).toBeNaN();
  });
});
