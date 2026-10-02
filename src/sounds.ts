export const sounds = [
  {
    id: "electro",
    name: "Electro lead",
    description: "Bright, filtered saw",
    waveform: "sawtooth",
    cutoff: 3600,
    resonance: 0.7,
    drive: 1.7,
    level: 0.12,
    octave: 0,
  },
  {
    id: "pulse",
    name: "Pulse lead",
    description: "Crisp, square-wave synth",
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
    waveform: "sawtooth",
    cutoff: 550,
    resonance: 0.7,
    drive: 2.4,
    level: 0.15,
    octave: -12,
  },
  {
    id: "glass",
    name: "Glass",
    description: "Clear, shimmering harmonics",
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
    waveform: "sine",
    cutoff: 16000,
    resonance: 0.5,
    drive: 1,
    level: 0.12,
    octave: 0,
  },
] as const;
export type SoundId = (typeof sounds)[number]["id"];
export const soundKey = "wf-equation-sound";
export function soundPreset(id: unknown) {
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
