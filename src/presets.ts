import type { Track } from "./model";
export const soundPresets: {
  name: string;
  instrument: Track["instrument"];
  settings: Partial<Track>;
}[] = [
  {
    name: "Techno kick",
    instrument: "kick",
    settings: { volume: 0.65, pan: 0 },
  },
  { name: "Hard kick", instrument: "kick", settings: { volume: 0.95, pan: 0 } },
  {
    name: "Sub bass",
    instrument: "bass",
    settings: {
      waveform: "sine",
      attack: 0.005,
      decay: 0.12,
      sustain: 0.55,
      release: 0.1,
      cutoff: 500,
      detune: 0,
    },
  },
  {
    name: "Acid bass",
    instrument: "bass",
    settings: {
      waveform: "sawtooth",
      attack: 0.003,
      decay: 0.08,
      sustain: 0.2,
      release: 0.08,
      cutoff: 1400,
      detune: 0,
    },
  },
  {
    name: "Pluck",
    instrument: "synth",
    settings: {
      waveform: "triangle",
      attack: 0.003,
      decay: 0.16,
      sustain: 0.05,
      release: 0.15,
      cutoff: 5000,
      detune: 0,
    },
  },
  {
    name: "Screech lead",
    instrument: "synth",
    settings: {
      waveform: "sawtooth",
      attack: 0.004,
      decay: 0.09,
      sustain: 0.4,
      release: 0.09,
      cutoff: 9000,
      detune: 7,
    },
  },
  {
    name: "Soft pad",
    instrument: "synth",
    settings: {
      waveform: "triangle",
      attack: 0.35,
      decay: 0.3,
      sustain: 0.65,
      release: 1.2,
      cutoff: 2000,
      detune: -4,
    },
  },
  {
    name: "Snare roll",
    instrument: "snare",
    settings: { volume: 0.42, pan: 0 },
  },
  {
    name: "Closed hat",
    instrument: "hat",
    settings: { volume: 0.4, pan: 0.15 },
  },
  {
    name: "Open hat",
    instrument: "open-hat",
    settings: { volume: 0.35, pan: -0.15 },
  },
  { name: "Clap", instrument: "clap", settings: { volume: 0.5, pan: 0 } },
];
