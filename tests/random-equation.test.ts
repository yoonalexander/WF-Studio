import { describe, it, expect, vi } from "vitest";
import katex from "katex";
import { createMathEngine } from "../src/math";
import { makeTrack } from "../src/model";
import {
  createRandomEquationGenerator,
  randomEquationFamilies,
} from "../src/random-equation";

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe("random equation exploration", () => {
  it.each(randomEquationFamilies.map((family, i) => [i, family] as const))(
    "family %i renders and stays playable across parameter extremes",
    (_, family) => {
      for (const random of [
        () => 0,
        () => 0.999999,
        () => 0.5,
        seeded(91),
        seeded(384),
      ]) {
        const expression = family.generate(random);
        const track = { ...makeTrack(), symbol: "f", expression };
        const engine = createMathEngine([track]);
        expect(engine.errors, expression).toEqual({});
        expect(() =>
          katex.renderToString(engine.tex[track.id], { throwOnError: true }),
        ).not.toThrow();
        const audible: number[] = [];
        for (let i = -128; i <= 128; i++) {
          // A dyadic grid aliases the screenshot's dense triangle folds to zero.
          const value = engine.value(
            track.id,
            i / ("referenceId" in family ? 31 : 32),
          );
          if (Number.isFinite(value)) {
            if (!("referenceId" in family))
              expect(Math.abs(value), expression).toBeLessThanOrEqual(24);
            if (i >= 0 && i < 128) audible.push(value);
          } else if (!("referenceId" in family))
            expect(family.category).toBe("gaps");
        }
        expect(audible.length, expression).toBeGreaterThanOrEqual(
          "referenceId" in family ? 8 : 32,
        );
        expect(
          Math.max(...audible) - Math.min(...audible),
          expression,
        ).toBeGreaterThan("referenceId" in family ? 0 : 0.5);
      }
    },
  );
  it("explores every category each cycle and every family before repeating", () => {
    const drawn: { index: number; category: string }[] = [];
    const spies = randomEquationFamilies.map((family, index) => {
      const original = family.generate;
      return vi.spyOn(family, "generate").mockImplementation((random) => {
        drawn.push({ index, category: family.category });
        return original(random);
      });
    });
    try {
      const next = createRandomEquationGenerator(seeded(127));
      let expression = "";
      for (let i = 0; i < 256; i++) {
        const previous = expression;
        expression = next(expression);
        expect(expression).not.toBe(previous);
      }
      expect(drawn).toHaveLength(256);
      for (let i = 0; i < drawn.length; i += 8)
        expect(
          new Set(drawn.slice(i, i + 8).map((draw) => draw.category)).size,
        ).toBe(8);
      for (const category of new Set(drawn.map((d) => d.category))) {
        const size = randomEquationFamilies.filter(
          (f) => f.category === category,
        ).length;
        const selections = drawn.filter((d) => d.category === category);
        for (let i = 0; i + size <= selections.length; i += size)
          expect(
            new Set(selections.slice(i, i + size).map((d) => d.index)).size,
          ).toBe(size);
      }
      expect(new Set(drawn.map((d) => d.index)).size).toBe(
        randomEquationFamilies.length,
      );
      for (let i = 1; i < drawn.length; i++)
        expect(drawn[i].category).not.toBe(drawn[i - 1].category);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
