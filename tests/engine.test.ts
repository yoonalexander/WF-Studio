import { describe, it, expect } from "vitest";
import { createMathEngine, mod } from "../src/math";
import { makeTrack, newProject, validateProject } from "../src/model";
import { exampleProject } from "../src/examples";
import { collectEvents, mapPitch } from "../src/music";
import { encodeMidi } from "../src/exports";
import katex from "katex";
function t(symbol: string, expression: string) {
  return { ...makeTrack(), symbol, expression };
}
describe("restricted equation engine", () => {
  it("evaluates modulo, trigonometry, booleans and safe helpers", () => {
    const track = t("A", "piecewise(x mod 2 < 1, sin(pi*x), exp(-x))");
    const e = createMathEngine([track]);
    expect(e.errors).toEqual({});
    expect(e.value(track.id, 0.5)).toBeCloseTo(1);
    expect(e.value(track.id, 1.5)).toBeCloseTo(Math.exp(-1.5));
    expect(mod(-1, 4)).toBe(3);
  });
  it("supports named functions, translation, declarations and bare function names", () => {
    const a = t("A", "A(x) = x^2"),
      b = t("B", "A(x+1) + A");
    const e = createMathEngine([a, b]);
    expect(e.errors).toEqual({});
    expect(e.value(b.id, 2)).toBe(13);
  });
  it("keeps piecewise branches lazy at singularities", () => {
    const a = t("A", "piecewise(x == 0, 7, 1/x)");
    expect(createMathEngine([a]).value(a.id, 0)).toBe(7);
  });
  it("supports video-style cases, first matching bounds, and lazy branches", () => {
    const a = t("A", "{ 7 if x == 0; 1 / x if -2 <= x < 2; -3 otherwise }");
    const e = createMathEngine([a]);
    expect(e.errors).toEqual({});
    expect(e.value(a.id, 0)).toBe(7);
    expect(e.value(a.id, -2)).toBe(-0.5);
    expect(e.value(a.id, 1)).toBe(1);
    expect(e.value(a.id, 2)).toBe(-3);
    expect(e.sample(a.id, 0).branch).not.toBe(e.sample(a.id, 1).branch);
    expect(e.tex[a.id]).toContain("\\begin{cases}");
    expect(e.tex[a.id]).toContain("otherwise");
    expect(() =>
      katex.renderToString(e.tex[a.id], { throwOnError: true }),
    ).not.toThrow();
  });
  it("leaves gaps undefined and applies inclusive/exclusive interval boundaries", () => {
    for (const expression of [
      "{ 6 if -2 <= x < 1 }",
      "6 { -2 <= x < 1 }",
      "bounded(6, -2 <= x < 1)",
    ]) {
      const a = t("A", expression),
        e = createMathEngine([a]);
      expect(e.errors).toEqual({});
      expect(e.value(a.id, -2)).toBe(6);
      expect(e.value(a.id, 0)).toBe(6);
      expect(e.value(a.id, 1)).toBeNaN();
      expect(e.value(a.id, -2.001)).toBeNaN();
      expect(e.tex[a.id]).not.toContain("otherwise");
      expect(() =>
        katex.renderToString(e.tex[a.id], { throwOnError: true }),
      ).not.toThrow();
    }
  });
  it("evaluates the screenshot's repeating three-branch equation", () => {
    const a = t(
      "A",
      "{ 3 * (1 - 2 * floor(2 * (6 * x mod 1))) if x mod 2 < 0.5; -1.2 if x mod 2 < 1.2; 2.2 * 2 * (2 * x - floor(2 * x + 0.5)) otherwise }",
    );
    const e = createMathEngine([a]);
    expect(e.errors).toEqual({});
    expect(e.value(a.id, 0)).toBe(3);
    expect(e.value(a.id, 0.5)).toBe(-1.2);
    expect(e.value(a.id, 1.2)).toBeCloseTo(1.76);
    expect(e.value(a.id, 0.1)).toBe(-3);
    expect(e.sample(a.id, 0.01).branch).not.toBe(e.sample(a.id, 0.1).branch);
    expect(e.value(a.id, -1.5)).toBe(-1.2);
    expect(e.value(a.id, 2)).toBe(3);
  });
  it.each([
    "{ x if x < 1; 0 otherwise; 2 if x > 2 }",
    "{ x }",
    '{ import("fs") if x < 1 }',
    "x { x.constructor > 1 }",
    "{ x if x < 1; otherwise }",
    "{ x if }",
  ])("rejects malformed or unsafe bounds: %s", (expression) => {
    const a = t("A", expression);
    expect(createMathEngine([a]).errors[a.id]).toBeTruthy();
  });
  it.each([
    ["pulse(1, 0.25)", 0.24, 0.26],
    ["sequence(0, 7, 3)", 0.99, 1.01],
    ["step(0, 4, 7)", 0.99, 1.01],
    ["quantize(x, 2)", 0.99, 1.01],
    ["beat(1)", 0.99, 1.01],
    ["bar(1)", 3.99, 4.01],
    ["noise(17)", 0.02, 0.022],
    ["random(23)", 0.02, 0.022],
    ["sign(x)", -0.1, 0.1],
  ] as const)(
    "splits graph paths at helper discontinuities: %s",
    (expression, left, right) => {
      const a = t("A", expression),
        e = createMathEngine([a]);
      expect(e.errors).toEqual({});
      const before = e.sample(a.id, left),
        after = e.sample(a.id, right);
      expect(before.value).not.toBe(after.value);
      expect(before.branch).not.toBe(after.branch);
      expect(e.sample(a.id, left - 0.0001).branch).toBe(before.branch);
    },
  );
  it("supports calculator conditionals and transformations", () => {
    const a = t("A", "if x < 2 then 1 else 0");
    a.transform = { shift: 1, speed: 2, gain: 3, offset: 4 };
    const e = createMathEngine([a]);
    expect(e.value(a.id, -0.5)).toBe(7);
    expect(e.value(a.id, 1)).toBe(4);
  });
  it.each([
    'import("fs")',
    "x.constructor",
    "[1,2,3]",
    "a = 1",
    "f(x) = x",
    'evaluate("2+2")',
    "1:99999999",
    "factorial(100000)",
    "sin()",
    "pulse(1)",
    "x!",
    "x[1]",
    "{a:1}",
  ])("rejects unsafe or unsupported syntax: %s", (expression) => {
    const a = t("A", expression);
    const e = createMathEngine([a]);
    expect(e.errors[a.id]).toBeTruthy();
    expect(Number.isNaN(e.value(a.id, 0))).toBe(true);
  });
  it("detects dependency cycles without breaking independent tracks", () => {
    const a = t("A", "B(x)"),
      b = t("B", "A(x)"),
      c = t("C", "x+1");
    const e = createMathEngine([a, b, c]);
    expect(e.errors[a.id]).toContain("Circular dependency");
    expect(e.errors[b.id]).toContain("Circular dependency");
    expect(e.value(c.id, 4)).toBe(5);
  });
  it("caps work for exponentially expanded function graphs", () => {
    const tracks = [t("A0", "x")];
    for (let i = 1; i < 14; i++)
      tracks.push(t(`A${i}`, `A${i - 1}(x) + A${i - 1}(x+1)`));
    const e = createMathEngine(tracks);
    expect(Number.isNaN(e.value(tracks.at(-1)!.id, 1))).toBe(true);
  });
  it("handles undefined values and malformed expression length safely", () => {
    const a = t("A", "1/0");
    expect(Number.isNaN(createMathEngine([a]).value(a.id, 1))).toBe(true);
    a.expression = "x".repeat(1025);
    expect(createMathEngine([a]).errors[a.id]).toContain("1,024");
  });
  it("noise is deterministic for reproducible audio and graphics", () => {
    const a = t("A", "noise(23)");
    const e = createMathEngine([a]);
    expect(e.value(a.id, 3)).toBe(e.value(a.id, 3));
    expect(e.value(a.id, 3)).not.toBe(e.value(a.id, 4));
  });
});
describe("musical mapping and arrangement", () => {
  it("generates exactly four beat kicks and eight half-beat hats", () => {
    const p = newProject();
    p.tracks = [makeTrack("kick", 0), makeTrack("hat", 1)];
    const events = collectEvents(p, 0, 4);
    expect(
      events.filter((e) => e.trackId === p.tracks[0].id).map((e) => e.beat),
    ).toEqual([0, 1, 2, 3]);
    expect(events.filter((e) => e.trackId === p.tracks[1].id)).toHaveLength(8);
  });
  it("respects mute, solo, invalid tracks and section activation", () => {
    const p = exampleProject();
    const events = collectEvents(p, 0, 4);
    expect(new Set(events.map((e) => e.trackId))).toEqual(
      new Set(p.tracks.slice(0, 2).map((t) => t.id)),
    );
    p.tracks[0].muted = true;
    p.tracks[1].solo = true;
    expect(new Set(collectEvents(p, 0, 4).map((e) => e.trackId))).toEqual(
      new Set([p.tracks[1].id]),
    );
    p.tracks[1].expression = "bad(x)";
    expect(collectEvents(p, 0, 4)).toHaveLength(0);
  });
  it("quantizes pitch to musical scales and clamps extreme notes", () => {
    const track = makeTrack();
    track.scale = "major";
    expect(mapPitch(3, track)).toBe(62);
    expect(mapPitch(10000, track)).toBeLessThanOrEqual(108);
  });
  it("maps amplitude, filter and pan into bounded controls", () => {
    const p = newProject(),
      track = makeTrack();
    p.tracks = [track];
    track.expression = "100";
    track.mapping = "amplitude";
    expect(collectEvents(p, 0, 1)[0].velocity).toBe(1);
    track.mapping = "pan";
    expect(collectEvents(p, 0, 1)[0].pan).toBe(1);
    track.mapping = "filter";
    expect(collectEvents(p, 0, 1)[0].cutoff).toBe(12000);
  });
  it("gate duration follows the mathematical condition", () => {
    const p = newProject(),
      track = makeTrack();
    p.tracks = [track];
    track.expression = "pulse(1, 0.25)";
    track.mode = "event";
    track.mapping = "gate";
    track.threshold = 0.5;
    const events = collectEvents(p, 0, 2);
    expect(events).toHaveLength(2);
    expect(events[0].duration).toBeCloseTo(0.25, 2);
  });
});
describe("project files and MIDI", () => {
  it("validates every shipped example and round-trips JSON", () => {
    for (let i = 0; i < 3; i++) {
      const p = exampleProject(i);
      expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
      expect(createMathEngine(p.tracks).errors).toEqual({});
    }
  });
  it("rejects overlarge projects, duplicate names, invalid ranges and future versions", () => {
    const p = exampleProject();
    expect(() => validateProject({ ...p, version: 99 })).toThrow();
    expect(() =>
      validateProject({
        ...p,
        loop: { enabled: true, startBeat: 4, endBeat: 2 },
      }),
    ).toThrow();
    expect(() =>
      validateProject({ ...p, tracks: Array(33).fill(p.tracks[0]) }),
    ).toThrow();
    const duplicate = structuredClone(p);
    duplicate.tracks[1].symbol = duplicate.tracks[0].symbol;
    expect(() => validateProject(duplicate)).toThrow();
    p.sections[1].startBeat = 3;
    expect(() => validateProject(p)).toThrow();
  });
  it("writes a format 1 MIDI file with tempo and all tracks", async () => {
    const p = exampleProject(),
      blob = encodeMidi(p, 0, 4),
      bytes = new Uint8Array(await blob.arrayBuffer()),
      view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("MThd");
    expect(view.getUint16(8)).toBe(1);
    expect(view.getUint16(10)).toBe(p.tracks.length + 1);
    expect(view.getUint16(12)).toBe(480);
  });
});
