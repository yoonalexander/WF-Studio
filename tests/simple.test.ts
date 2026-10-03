import { describe, it, expect } from "vitest";
import { newSimpleSong, fitComposition, soundState } from "../src/simple";
import { simpleExampleProject } from "../src/examples";
import { collectEvents, continuousAt } from "../src/music";
import { createMathEngine } from "../src/math";
import { validateProject, isTrackActive } from "../src/model";

describe("simple composition", () => {
  it("starts a real editable song, with no hidden arrangement or effects", () => {
    const p = newSimpleSong();
    expect(validateProject(p)).toEqual(p);
    expect(p.sections).toEqual([]);
    expect(p.delay).toBe(0);
    const engine = createMathEngine(p.tracks);
    const first = p.tracks[0];
    expect(continuousAt(p, first, 0.25, engine)?.note).toBeCloseTo(
      60 + 4 * Math.sin(Math.PI / 8),
    );
  });
  it.each([0, 1, 2])(
    "example %i plays all its sounds from the first loop",
    (index) => {
      const p = simpleExampleProject(index);
      expect(validateProject(p)).toEqual(p);
      expect(p.sections).toEqual([]);
      const events = collectEvents(p, 0, 8);
      for (const t of p.tracks) {
        expect(isTrackActive(p, t, 0)).toBe(true);
        expect(events.some((e) => e.trackId === t.id && e.beat < 8)).toBe(true);
        const engine = createMathEngine(p.tracks);
        for (const event of events.filter((e) => e.trackId === t.id)) {
          expect(event.value).toBeCloseTo(engine.value(t.id, event.beat));
        }
      }
    },
  );
  it("fits every finite layer and the full loop, even when a value is far outside the old view", () => {
    const p = simpleExampleProject();
    const view = fitComposition(
      p,
      p.tracks.map((t, i) => ({
        id: t.id,
        values: Float32Array.from([i * -100, i * 200, NaN]),
      })),
    );
    expect(view.start).toBe(0);
    expect(view.span).toBe(8);
    expect(view.yCenter - view.ySpan / 2).toBeLessThan(-400);
    expect(view.yCenter + view.ySpan / 2).toBeGreaterThan(800);
    p.loop.enabled = false;
    p.lengthBeats = 64;
    expect(fitComposition(p, []).span).toBe(64);
  });
  it("never says playing just because the equation has a value", () => {
    const p = newSimpleSong(),
      t = p.tracks[0];
    expect(soundState(p, t, 0, true, [])).toBe("Silent here");
    const event = collectEvents(p, 0, 1)[0];
    expect(soundState(p, t, 0, true, [event])).toBe("Playing C4");
    t.muted = true;
    expect(soundState(p, t, 0, true, [event])).toBe("Muted");
    t.muted = false;
    t.mapping = "visual";
    expect(soundState(p, t, 0, true, [event])).toBe("Graph only");
  });
  it("continuous mappings honor raw fractional pitch, bounds, transforms and routing", () => {
    const p = newSimpleSong(),
      track = p.tracks[0];
    track.expression = "6.25 { x < 1 }";
    track.scale = "minor";
    let engine = createMathEngine(p.tracks);
    expect(continuousAt(p, track, 0.5, engine)?.note).toBe(66.25);
    expect(continuousAt(p, track, 1, engine)).toBeUndefined();
    track.expression = "x";
    track.transform = { shift: 1, speed: 2, gain: 3, offset: 4 };
    track.mapping = "amplitude";
    track.inputMin = 0;
    track.inputMax = 20;
    engine = createMathEngine(p.tracks);
    expect(continuousAt(p, track, 1, engine)?.velocity).toBe(0.8);
    track.mapping = "pan";
    expect(continuousAt(p, track, 1, engine)?.pan).toBeCloseTo(0.6);
    track.mapping = "filter";
    expect(continuousAt(p, track, 1, engine)?.cutoff).toBeCloseTo(
      100 * 120 ** 0.8,
    );
    track.muted = true;
    expect(continuousAt(p, track, 1, engine)).toBeUndefined();
  });
  it("makes imported arrangement silence and solo states explicit", () => {
    const p = simpleExampleProject(),
      t = p.tracks[3];
    p.sections = [
      {
        id: "intro",
        name: "Intro",
        startBeat: 0,
        endBeat: 4,
        activeTrackIds: [p.tracks[0].id],
      },
      {
        id: "drop",
        name: "Drop",
        startBeat: 4,
        endBeat: 8,
        activeTrackIds: [t.id],
      },
    ];
    expect(soundState(p, t, 0, true, [])).toBe("Starts at x = 4");
    p.tracks[0].solo = true;
    expect(soundState(p, t, 0, true, [])).toBe("Other sound soloed");
  });
});
