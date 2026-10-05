import { describe, expect, it } from "vitest";
import { ContinuousAudio } from "../src/continuous-audio";
import { newSimpleSong } from "../src/simple";

function transport(extent = 4) {
  const project = newSimpleSong();
  project.bpm = 120;
  project.lengthBeats = project.loop.endBeat = 4;
  const audio = new ContinuousAudio();
  const clock = { currentTime: 0 };
  audio.context = clock as AudioContext;
  audio.update(project, extent);
  audio.playing = true;
  return { audio, clock, project };
}

describe("homepage playback range", () => {
  it("reveals one full traversal and keeps the completed line on subsequent loops", () => {
    const { audio, clock } = transport();
    audio.setReveal(true);
    expect(audio.position()).toBe(-4);
    expect(audio.revealBoundary()).toBe(-4);
    clock.currentTime = 1;
    expect(audio.position()).toBe(-2);
    expect(audio.revealBoundary()).toBe(-2);
    clock.currentTime = 4;
    expect(audio.position()).toBe(-4);
    expect(audio.revealBoundary()).toBeUndefined();
    clock.currentTime = 12.5;
    expect(audio.position()).toBe(-3);
    expect(audio.revealBoundary()).toBeUndefined();
  });

  it("changes speed without moving the dot or losing reveal progress", () => {
    const { audio, clock } = transport();
    audio.setReveal(true);
    clock.currentTime = 0.5;
    audio.setSpeed(2);
    expect(audio.position()).toBe(-3);
    expect(audio.revealBoundary()).toBe(-3);
    clock.currentTime = 1;
    expect(audio.position()).toBe(-1);
    expect(audio.revealBoundary()).toBe(-1);
    audio.setSpeed(0.25);
    expect(audio.position()).toBe(-1);
    clock.currentTime = 3;
    expect(audio.position()).toBe(0);
    expect(audio.revealBoundary()).toBe(0);
  });

  it("holds reveal progress while paused and restarts at the left for a new equation or X range", () => {
    const { audio, clock, project } = transport();
    audio.setReveal(true);
    clock.currentTime = 1;
    audio.pause();
    clock.currentTime = 100;
    expect(audio.position()).toBe(-2);
    expect(audio.revealBoundary()).toBe(-2);
    const edited = structuredClone(project);
    edited.tracks[0].expression = "2";
    audio.update(edited);
    expect(audio.position()).toBe(-4);
    expect(audio.revealBoundary()).toBe(-4);
    audio.update(edited, 8);
    expect(audio.position()).toBe(-8);
    expect(audio.revealBoundary()).toBe(-8);
    audio.setReveal(false);
    expect(audio.revealBoundary()).toBeUndefined();
  });

  it("traverses an expanded range at the same tempo and wraps from its right edge to its left", () => {
    const { audio, clock } = transport(56.64);
    clock.currentTime = 28;
    expect(audio.position()).toBe(56);
    clock.currentTime = 28.32;
    expect(audio.position()).toBeCloseTo(-56.64);
    clock.currentTime = 29;
    expect(audio.position()).toBeCloseTo(-55.28);
    audio.seek(-56.64);
    expect(audio.position()).toBeCloseTo(-56.64);
  });

  it("keeps its current position when expanded during playback and retains the range on equation updates", () => {
    const { audio, clock, project } = transport();
    clock.currentTime = 1.9;
    expect(audio.position()).toBeCloseTo(3.8);
    audio.update(project, 12);
    expect(audio.position()).toBeCloseTo(3.8);
    clock.currentTime = 2.5;
    expect(audio.position()).toBeCloseTo(5);
    project.tracks[0].expression = "x / 2";
    audio.update(project);
    expect(audio.position()).toBeCloseTo(5);
    clock.currentTime = 6;
    expect(audio.position()).toBeCloseTo(-12);
    audio.update(project, 4);
    expect(audio.position()).toBeCloseTo(-4);
    clock.currentTime = 6.5;
    expect(audio.position()).toBeCloseTo(-3);
  });

  it("holds x = 0 safely at zero and resumes from zero when expanded", () => {
    const { audio, clock, project } = transport();
    audio.seek(3);
    audio.update(project, 0);
    clock.currentTime = 100;
    expect(audio.position()).toBe(0);
    audio.update(project, 8);
    expect(audio.position()).toBe(0);
    clock.currentTime = 101;
    expect(audio.position()).toBe(2);
  });

  it("preserves a precise clock for very large finite scales", () => {
    const { audio, clock } = transport(Number.MAX_VALUE / 4);
    clock.currentTime = 0.125;
    expect(audio.position()).toBe(0.25);
  });
});
