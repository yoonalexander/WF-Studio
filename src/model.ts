import { z } from "zod";

export const MAX_TRACKS = 32;
const bounded = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const trackSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(60),
    symbol: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/),
    expression: z.string().max(1024),
    mode: z.enum(["control", "event"]),
    enabled: z.boolean(),
    muted: z.boolean(),
    solo: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    instrument: z.enum([
      "kick",
      "snare",
      "hat",
      "open-hat",
      "clap",
      "synth",
      "bass",
    ]),
    mapping: z.enum([
      "pitch",
      "trigger",
      "gate",
      "amplitude",
      "filter",
      "pan",
      "visual",
    ]),
    crossing: z.enum(["rising", "falling", "either", "change"]),
    threshold: bounded(-1000, 1000),
    inputMin: bounded(-1000, 1000),
    inputMax: bounded(-1000, 1000),
    baseNote: bounded(12, 108).int(),
    scale: z.enum([
      "chromatic",
      "major",
      "minor",
      "harmonic-minor",
      "pentatonic",
    ]),
    interval: bounded(0.125, 4),
    noteLength: bounded(0.05, 4),
    volume: bounded(0, 1),
    pan: bounded(-1, 1),
    waveform: z.enum(["sine", "triangle", "sawtooth", "square"]),
    attack: bounded(0.002, 2),
    decay: bounded(0.01, 2),
    sustain: bounded(0, 1),
    release: bounded(0.01, 3),
    cutoff: bounded(40, 16000),
    detune: bounded(-100, 100),
    transform: z.object({
      shift: bounded(-64, 64),
      speed: bounded(0.125, 8),
      gain: bounded(-8, 8),
      offset: bounded(-32, 32),
    }),
  })
  .refine((t) => t.inputMax > t.inputMin, "Input maximum must exceed minimum");
export const sectionSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(40),
    startBeat: bounded(0, 512),
    endBeat: bounded(0.25, 512),
    activeTrackIds: z.array(z.string().max(80)).max(MAX_TRACKS),
  })
  .refine((s) => s.endBeat > s.startBeat, "Section end must follow start");
export const projectSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(100),
    bpm: bounded(30, 300),
    beatsPerBar: bounded(2, 7).int(),
    lengthBeats: bounded(1, 512),
    loop: z.object({
      enabled: z.boolean(),
      startBeat: bounded(0, 511),
      endBeat: bounded(0.25, 512),
    }),
    tracks: z.array(trackSchema).max(MAX_TRACKS),
    sections: z.array(sectionSchema).max(32),
    visuals: z.object({
      theme: z.enum(["dark", "light", "neon", "blueprint", "mono"]),
      grid: z.boolean(),
      glow: z.boolean(),
      combined: z.boolean(),
      lineWidth: bounded(1, 5),
      follow: z.boolean(),
    }),
    master: bounded(0, 1),
    delay: bounded(0, 0.6),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
  })
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (p.loop.endBeat <= p.loop.startBeat || p.loop.endBeat > p.lengthBeats)
      fail("Loop must fit inside the project");
    if (new Set(p.tracks.map((t) => t.id)).size !== p.tracks.length)
      fail("Duplicate track IDs");
    if (new Set(p.tracks.map((t) => t.symbol)).size !== p.tracks.length)
      fail("Function names must be unique");
    if (new Set(p.sections.map((s) => s.id)).size !== p.sections.length)
      fail("Duplicate section IDs");
    const sections = [...p.sections].sort((a, b) => a.startBeat - b.startBeat);
    sections.forEach((s, i) => {
      if (
        s.endBeat > p.lengthBeats ||
        (i > 0 && s.startBeat < sections[i - 1].endBeat)
      )
        fail("Sections must fit and cannot overlap");
      if (s.activeTrackIds.some((id) => !p.tracks.some((t) => t.id === id)))
        fail("Section references a missing track");
    });
  });
export type Track = z.infer<typeof trackSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Section = z.infer<typeof sectionSchema>;
export const colors = [
  "#80d8ca",
  "#e9b478",
  "#a9a2ef",
  "#f28f9e",
  "#8dc3ed",
  "#d7cf7b",
];
export function makeTrack(
  instrument: Track["instrument"] = "synth",
  index = 0,
): Track {
  const symbols = ["K", "B", "H", "L", "S", "C"];
  const drum = ["kick", "snare", "hat", "open-hat", "clap"].includes(
    instrument,
  );
  return {
    id: crypto.randomUUID(),
    name:
      instrument === "synth"
        ? "Lead"
        : instrument === "bass"
          ? "Bass"
          : instrument === "open-hat"
            ? "Open hat"
            : instrument[0].toUpperCase() + instrument.slice(1),
    symbol: symbols[index] ?? `F${index + 1}`,
    expression:
      instrument === "kick"
        ? "exp(-8 * (x mod 1))"
        : drum
          ? "pulse(0.5, 0.08)"
          : "sequence(0, 3, 5, 7)",
    mode: drum ? "event" : "control",
    enabled: true,
    muted: false,
    solo: false,
    color: colors[index % colors.length],
    instrument,
    mapping: drum ? "trigger" : "pitch",
    crossing: "rising",
    threshold: 0.8,
    inputMin: -1,
    inputMax: 1,
    baseNote: instrument === "bass" ? 36 : 60,
    scale: "minor",
    interval: 0.5,
    noteLength: 0.32,
    volume: drum ? 0.65 : 0.4,
    pan: 0,
    waveform: instrument === "bass" ? "triangle" : "sawtooth",
    attack: 0.006,
    decay: 0.15,
    sustain: 0.3,
    release: 0.12,
    cutoff: instrument === "bass" ? 800 : 4200,
    detune: 0,
    transform: { shift: 0, speed: 1, gain: 1, offset: 0 },
  };
}
export function newProject(): Project {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "Untitled composition",
    bpm: 128,
    beatsPerBar: 4,
    lengthBeats: 64,
    loop: { enabled: true, startBeat: 0, endBeat: 16 },
    tracks: [],
    sections: [],
    visuals: {
      theme: "dark",
      grid: true,
      glow: false,
      combined: false,
      lineWidth: 2,
      follow: false,
    },
    master: 0.65,
    delay: 0.12,
    createdAt: now,
    updatedAt: now,
  };
}
export function validateProject(value: unknown): Project {
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue.path.join(".") || "Project"}: ${issue.message}`);
  }
  return parsed.data;
}
export function isTrackActive(
  project: Project,
  track: Track,
  beat: number,
): boolean {
  if (!track.enabled || track.muted || track.mapping === "visual") return false;
  if (
    project.tracks.some((t) => t.enabled && t.solo && !t.muted) &&
    !track.solo
  )
    return false;
  const section = project.sections.find(
    (s) => beat >= s.startBeat && beat < s.endBeat,
  );
  return !section || section.activeTrackIds.includes(track.id);
}
