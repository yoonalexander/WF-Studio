import type { Project, Track } from "./model";
import { isTrackActive } from "./model";
import { clamp, createMathEngine } from "./math";
import type { MathEngine } from "./math";
export const RESOLUTION = 48;
export interface MusicEvent {
  trackId: string;
  beat: number;
  duration: number;
  note: number;
  velocity: number;
  cutoff: number;
  pan: number;
}
const scales = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10],
};
export function mapPitch(value: number, track: Track) {
  const target = track.baseNote + clamp(value, -48, 48);
  const allowed = scales[track.scale];
  const root = track.baseNote % 12;
  let best = track.baseNote,
    distance = Infinity;
  for (let note = 12; note <= 108; note++) {
    if (
      allowed.includes((note - root + 120) % 12) &&
      Math.abs(note - target) < distance
    ) {
      best = note;
      distance = Math.abs(note - target);
    }
  }
  return best;
}
export function eventAt(
  project: Project,
  track: Track,
  beat: number,
  engine: MathEngine,
): MusicEvent | undefined {
  if (!isTrackActive(project, track, beat) || engine.errors[track.id]) return;
  const y = engine.value(track.id, beat);
  if (!Number.isFinite(y)) return;
  const step = 1 / RESOLUTION;
  const previous = engine.value(
    track.id,
    Math.round((beat - step) * RESOLUTION) / RESOLUTION,
  );
  let fire = false;
  if (
    track.mapping === "trigger" ||
    track.mapping === "gate" ||
    track.mode === "event"
  ) {
    const high = y > track.threshold,
      wasHigh = Number.isFinite(previous) && previous > track.threshold;
    const start =
      beat < step / 2 ||
      (project.loop.enabled &&
        Math.abs(beat - project.loop.startBeat) < step / 2) ||
      project.sections.some((s) => Math.abs(s.startBeat - beat) < step / 2);
    fire =
      track.crossing === "change"
        ? Math.floor(y) !== Math.floor(previous)
        : track.crossing === "falling"
          ? !high && wasHigh
          : track.crossing === "either"
            ? high !== wasHigh
            : high && (!wasHigh || start);
  } else {
    fire =
      Math.abs(beat / track.interval - Math.round(beat / track.interval)) <
      0.001;
  }
  if (!fire) return;
  const normalized = clamp(
    (y - track.inputMin) / (track.inputMax - track.inputMin),
    0,
    1,
  );
  let duration = track.noteLength;
  if (track.mapping === "gate") {
    duration = step;
    while (
      duration < 4 &&
      beat + duration < project.lengthBeats &&
      engine.value(track.id, beat + duration) > track.threshold
    )
      duration += step;
  }
  return {
    trackId: track.id,
    beat,
    duration,
    note: track.mapping === "pitch" ? mapPitch(y, track) : track.baseNote,
    velocity: track.mapping === "amplitude" ? normalized : 1,
    cutoff: track.mapping === "filter" ? 100 * 120 ** normalized : track.cutoff,
    pan: track.mapping === "pan" ? normalized * 2 - 1 : track.pan,
  };
}
export function collectEvents(
  project: Project,
  start: number,
  end: number,
  engine = createMathEngine(project.tracks, project.beatsPerBar),
): MusicEvent[] {
  const events: MusicEvent[] = [];
  for (
    let tick = Math.max(0, Math.ceil(start * RESOLUTION - 1e-6));
    tick < end * RESOLUTION - 1e-6;
    tick++
  )
    for (const track of project.tracks) {
      const event = eventAt(project, track, tick / RESOLUTION, engine);
      if (event) {
        events.push(event);
        if (events.length > 16000)
          throw new Error(
            "Export exceeds 16,000 notes. Shorten the range or reduce note density.",
          );
      }
    }
  return events;
}
