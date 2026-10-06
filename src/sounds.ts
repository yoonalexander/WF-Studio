import { iconicSounds } from "./iconic-sounds";

export const soundCategories = [
  "All",
  "Bass",
  "Lead",
  "Pad",
  "Keys & bells",
  "Chords",
  "FX",
] as const;
export type SoundCategory = Exclude<(typeof soundCategories)[number], "All">;
export interface SoundLayer {
  waveform?: OscillatorType;
  semitones?: number;
  cents?: number;
  level: number;
}
export interface SoundRecipe {
  layers?: readonly SoundLayer[];
  fm?: { ratio: number; index: number; decay: number; sustain: number };
  vibrato?: { rate: number; cents: number };
  table?: "pwm" | "wavetable" | "sync" | "sid";
  chorus?: boolean;
  delay?: { time: number; feedback: number; wet: number };
  formants?: readonly number[];
  talking?: boolean;
  noise?: number;
  arp?: boolean;
  tremolo?: { rate: number; depth: number };
  attack?: number;
  decay?: number;
  sustain?: number;
  filterRange?: number;
  filterDecay?: number;
  pitchDrop?: number;
}
export interface SoundPreset {
  id: string;
  name: string;
  description: string;
  category: SoundCategory;
  waveform: OscillatorType;
  harmonics?: readonly number[];
  cutoff: number;
  resonance: number;
  drive: number;
  level: number;
  octave: number;
  glide?: number;
  envelopeRange?: number;
  envelopeDecay?: number;
  recipe?: SoundRecipe;
}

export const sounds = [
  {
    id: "electro",
    name: "Electro lead",
    description: "Bright, filtered saw",
    category: "Lead",
    waveform: "sawtooth",
    cutoff: 3600,
    resonance: 0.7,
    drive: 1.7,
    level: 0.12,
    octave: 0,
  },
  {
    id: "deep-electro",
    name: "Deep electro",
    description: "Electro lead, one octave deeper",
    category: "Lead",
    waveform: "sawtooth",
    cutoff: 3600,
    resonance: 0.7,
    drive: 1.7,
    level: 0.12,
    octave: -12,
  },
  {
    id: "pulse",
    name: "Pulse lead",
    description: "Crisp, square-wave synth",
    category: "Lead",
    waveform: "square",
    cutoff: 2500,
    resonance: 0.6,
    drive: 1.2,
    level: 0.085,
    octave: 0,
  },
  {
    id: "bass",
    name: "Warm bass",
    description: "Deep, rounded analog tone",
    category: "Bass",
    waveform: "sawtooth",
    cutoff: 550,
    resonance: 0.7,
    drive: 2.4,
    level: 0.15,
    octave: -12,
  },
  {
    id: "acid-303",
    name: "303 Acid bass",
    description: "TB-303-inspired resonant saw and glide",
    category: "Bass",
    waveform: "sawtooth",
    cutoff: 480,
    resonance: 6.5,
    drive: 2.2,
    level: 0.08,
    octave: -24,
    glide: 0.035,
    envelopeRange: 2800,
    envelopeDecay: 0.18,
  },
  {
    id: "glass",
    name: "Glass",
    description: "Clear, shimmering harmonics",
    category: "Keys & bells",
    waveform: "custom",
    harmonics: [0, 1, 0.35, 0, 0.22, 0, 0.1],
    cutoff: 7000,
    resonance: 0.5,
    drive: 1,
    level: 0.14,
    octave: 0,
  },
  {
    id: "keys",
    name: "Soft keys",
    description: "Mellow, warm triangle",
    category: "Keys & bells",
    waveform: "triangle",
    cutoff: 2800,
    resonance: 0.5,
    drive: 1.4,
    level: 0.14,
    octave: 0,
  },
  {
    id: "sine",
    name: "Pure sine",
    description: "The original smooth tone",
    category: "Lead",
    waveform: "sine",
    cutoff: 16000,
    resonance: 0.5,
    drive: 1,
    level: 0.12,
    octave: 0,
  },
  ...iconicSounds,
] as const satisfies readonly SoundPreset[];
export type SoundId = (typeof sounds)[number]["id"];
export const soundKey = "wf-equation-sound";
export function soundPreset(id: unknown): SoundPreset & { id: SoundId } {
  return sounds.find((sound) => sound.id === id) ?? sounds[0];
}

export function saturationCurve(drive: number) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = drive === 1 ? x : Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
