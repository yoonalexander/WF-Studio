import { makeTrack, newProject } from "./model";
import type { Project } from "./model";
export const exampleInfo = [
  {
    name: "Modulo club",
    category: "TECHNO · 140 BPM",
    description:
      "A four-on-the-floor kick, rolling bass, and a lead that opens up at the drop.",
  },
  {
    name: "Sine garden",
    category: "AMBIENT · 84 BPM",
    description:
      "Slow sine melodies, soft triangle tones, and gentle stereo movement.",
  },
  {
    name: "Piecewise playground",
    category: "EXPERIMENTAL · 118 BPM",
    description:
      "Conditional rhythms and translated functions. Change a number and listen.",
  },
];
export function exampleProject(index = 0): Project {
  const p = newProject();
  p.name = exampleInfo[index].name;
  p.loop.endBeat = 64;
  if (index === 1) {
    p.bpm = 84;
    p.delay = 0.3;
    p.tracks = [
      makeTrack("synth", 0),
      makeTrack("bass", 1),
      makeTrack("synth", 2),
    ];
    Object.assign(p.tracks[0], {
      name: "Petals",
      symbol: "P",
      expression: "4 + 3*sin(x*pi/8)",
      waveform: "triangle",
      interval: 1,
      noteLength: 1.5,
      attack: 0.2,
      release: 1.2,
      volume: 0.32,
      cutoff: 2500,
    });
    Object.assign(p.tracks[1], {
      name: "Roots",
      expression: "sequence(0, 0, -2, -2)",
      interval: 2,
      noteLength: 2,
      attack: 0.1,
      release: 0.5,
      volume: 0.35,
    });
    Object.assign(p.tracks[2], {
      name: "Drift",
      symbol: "D",
      expression: "sin(x*pi/4)",
      mapping: "pan",
      baseNote: 72,
      waveform: "sine",
      interval: 2,
      noteLength: 1.8,
      attack: 0.25,
      release: 1,
      volume: 0.22,
    });
  } else {
    p.bpm = index === 0 ? 140 : 118;
    p.tracks = [
      makeTrack("kick", 0),
      makeTrack("bass", 1),
      makeTrack("hat", 2),
      makeTrack("synth", 3),
      makeTrack("snare", 4),
    ];
    Object.assign(p.tracks[1], {
      expression: "sequence(0, 0, -4, -2)",
      interval: 0.25,
      noteLength: 0.18,
      scale: "chromatic",
      volume: 0.45,
    });
    Object.assign(p.tracks[3], {
      expression: "3 + sequence(0, 3, 0, -2, 0, 5, 3, 7)",
      volume: 0.25,
      pan: 0.2,
    });
    Object.assign(p.tracks[4], {
      expression: "pulse(4, 0.08, 2)",
      volume: 0.4,
      pan: -0.15,
    });
    if (index === 2) {
      p.tracks[0].expression =
        "piecewise(x mod 4 < 2, pulse(1, 0.1), pulse(0.5, 0.1))";
      p.tracks[3].expression = "B(x + 1) + 7";
      p.tracks[2].expression =
        "piecewise(x mod 8 < 6, pulse(0.5, 0.08), pulse(0.25, 0.05))";
    }
  }
  p.sections = [
    {
      id: crypto.randomUUID(),
      name: "Intro",
      startBeat: 0,
      endBeat: 16,
      activeTrackIds: p.tracks.slice(0, 2).map((t) => t.id),
    },
    {
      id: crypto.randomUUID(),
      name: "Build",
      startBeat: 16,
      endBeat: 32,
      activeTrackIds: p.tracks.filter((_, i) => i !== 3).map((t) => t.id),
    },
    {
      id: crypto.randomUUID(),
      name: "Drop",
      startBeat: 32,
      endBeat: 48,
      activeTrackIds: p.tracks.map((t) => t.id),
    },
    {
      id: crypto.randomUUID(),
      name: "Outro",
      startBeat: 48,
      endBeat: 64,
      activeTrackIds: p.tracks.slice(0, 3).map((t) => t.id),
    },
  ];
  return p;
}
export const simpleExampleInfo = [
  {
    name: "Modulo club",
    category: "DRUMS + BASS + MELODY",
    description:
      "A repeating 8-beat loop. All layers are active from the start. Mute a sound to hear what it contributes.",
  },
  {
    name: "Sine garden",
    category: "MELODY + BASS",
    description:
      "Smooth equations become notes every beat. Change the melody curve and hear its pitches change.",
  },
  {
    name: "Piecewise playground",
    category: "CONDITIONAL RHYTHMS",
    description:
      "An 8-beat loop with equation-controlled gaps. Note circles show exactly where each sound plays.",
  },
];
export function simpleExampleProject(index = 0): Project {
  const p = exampleProject(index);
  p.sections = [];
  p.lengthBeats = p.loop.endBeat = 8;
  p.delay = 0;
  if (index === 1) {
    p.tracks = p.tracks.slice(0, 2);
    p.tracks[0].expression = "4 + 3 * sin(x * pi / 4)";
    p.tracks[0].attack = 0.015;
    p.tracks[0].release = 0.15;
    p.tracks[0].noteLength = 0.8;
    p.tracks[1].attack = 0.015;
  }
  return p;
}
