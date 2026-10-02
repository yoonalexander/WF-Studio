import { makeTrack, newProject, isTrackActive } from "./model";
import type { Project, Track } from "./model";
import type { Curve, View } from "./graph-render";
import type { MusicEvent } from "./music";

export function compositionRange(project: Project, minimal = false) {
  if (minimal)
    return { start: -project.loop.endBeat, span: project.loop.endBeat * 2 };
  return project.loop.enabled
    ? {
        start: project.loop.startBeat,
        span: project.loop.endBeat - project.loop.startBeat,
      }
    : { start: 0, span: project.lengthBeats };
}
export function fitComposition(
  project: Project,
  curves: Curve[],
  minimal = false,
): View {
  let min = 0,
    max = 0;
  for (const curve of curves) {
    if (!project.tracks.some((t) => t.id === curve.id && t.enabled)) continue;
    for (const value of curve.values) {
      if (!Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const span = Math.max(2, max - min);
  return {
    ...compositionRange(project, minimal),
    yCenter: min / 2 + max / 2,
    ySpan: span * 1.25,
  };
}
export function newSimpleSong(): Project {
  const p = newProject();
  p.name = "My song";
  p.lengthBeats = p.loop.endBeat = 8;
  p.delay = 0;
  const t = makeTrack("synth");
  Object.assign(t, {
    name: "Melody",
    symbol: "M",
    expression: "4 * sin(x * pi / 2)",
    waveform: "triangle",
    interval: 0.5,
  });
  p.tracks = [t];
  return p;
}
export function noteName(note: number) {
  return `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][note % 12]}${Math.floor(note / 12) - 1}`;
}
export function soundState(
  project: Project,
  track: Track,
  beat: number,
  playing: boolean,
  notes: MusicEvent[],
  error?: string,
) {
  if (error) return "Check equation";
  if (!track.enabled) return "Disabled";
  if (track.muted || track.volume === 0 || project.master === 0) return "Muted";
  if (track.mapping === "visual") return "Graph only";
  if (
    project.tracks.some((t) => t.solo && t.enabled && !t.muted) &&
    !track.solo
  )
    return "Other sound soloed";
  if (!isTrackActive(project, track, beat)) {
    const next = project.sections
      .filter((s) => s.startBeat > beat && s.activeTrackIds.includes(track.id))
      .sort((a, b) => a.startBeat - b.startBeat)[0];
    return next ? `Starts at x = ${next.startBeat}` : "Silent in this section";
  }
  if (!playing) return "Ready";
  const note = notes.find((n) => n.trackId === track.id);
  return note
    ? track.mapping === "pitch"
      ? `Playing ${noteName(note.note)}`
      : "Playing"
    : "Between notes";
}
