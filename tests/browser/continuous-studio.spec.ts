import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newSimpleSong } from "../../src/simple";
import { makeTrack } from "../../src/model";

function recordStudioAudio() {
  const evidence = {
    context: undefined as AudioContext | undefined,
    compressor: undefined as DynamicsCompressorNode | undefined,
    voices: [] as {
      node: OscillatorNode;
      start: number;
      stop?: number;
      target?: AudioNode;
    }[],
    gains: new Map<AudioNode, GainNode>(),
    points: [] as { x: number; y: number }[],
    hollow: 0,
  };
  (window as unknown as { studioAudio: typeof evidence }).studioAudio =
    evidence;
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(options?: AudioContextOptions) {
      super(options);
      evidence.context = this;
    }
    createOscillator() {
      const node = super.createOscillator();
      const record: (typeof evidence.voices)[number] = {
        node,
        start: Infinity,
      };
      evidence.voices.push(record);
      const start = node.start.bind(node),
        stop = node.stop.bind(node),
        connect = node.connect.bind(node);
      node.start = (at = 0) => {
        record.start = at;
        start(at);
      };
      node.stop = (at = 0) => {
        record.stop = at;
        stop(at);
      };
      node.connect = ((target: AudioNode) => {
        record.target = target;
        return connect(target);
      }) as typeof node.connect;
      return node;
    }
    createBiquadFilter() {
      const node = super.createBiquadFilter(),
        connect = node.connect.bind(node);
      node.connect = ((target: AudioNode) => {
        if (target instanceof GainNode) evidence.gains.set(node, target);
        return connect(target);
      }) as typeof node.connect;
      return node;
    }
    createDynamicsCompressor() {
      const node = super.createDynamicsCompressor();
      evidence.compressor = node;
      return node;
    }
  };
  const fill = CanvasRenderingContext2D.prototype.fillRect,
    arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.fillRect = function (...args) {
    if (args[2] > 100 && args[3] > 100) {
      evidence.points = [];
      evidence.hollow = 0;
    }
    return fill.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.arc = function (...args) {
    if (args[2] === 6) evidence.points.push({ x: args[0], y: args[1] });
    if (args[2] === 3) evidence.hollow++;
    return arc.apply(this, args);
  };
}

test("Simple studio follows continuous math, keeps layered voices alive and exports sustained audio", async ({
  page,
}) => {
  await page.addInitScript(recordStudioAudio);
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  // Creating a song first saves the previous project asynchronously.
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  const tempo = page.getByLabel("BPM", { exact: true });
  await tempo.fill("");
  await tempo.pressSequentially("6");
  await expect(tempo).toHaveValue("6");
  await tempo.pressSequentially("0");
  await expect(tempo).toHaveValue("60");
  await page.getByLabel("Tone", { exact: true }).selectOption("sine");
  await expect(tempo).toHaveValue("60");
  await page.getByLabel("Equation expression").fill("12 * x");
  await expect(page.getByLabel("Note interval")).toHaveCount(0);
  await expect(page.getByLabel("Scale", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const e = (
        window as unknown as {
          studioAudio: {
            context: AudioContext;
            voices: {
              node: OscillatorNode;
              start: number;
              stop?: number;
              target?: AudioNode;
            }[];
            gains: Map<AudioNode, GainNode>;
            points: { x: number; y: number }[];
            hollow: number;
          };
        }
      ).studioAudio;
      return {
        time: e.context.currentTime,
        voices: e.voices.map((voice) => ({
          frequency: voice.node.frequency.value,
          gain: e.gains.get(voice.target!)?.gain.value,
          stop: voice.stop,
        })),
        points: e.points,
        hollow: e.hollow,
      };
    });
  await expect.poll(async () => (await state()).points.length).toBe(1);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeGreaterThan(0.07);
  // Worker startup can take time; restart the clock before measuring the ramp.
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeLessThan(350);
  const first = await state();
  await page.waitForTimeout(1200);
  const later = await state();
  expect(later.voices).toHaveLength(1);
  expect(later.voices[0].stop).toBeUndefined();
  expect(later.voices[0].frequency).toBeGreaterThan(
    first.voices[0].frequency * 1.8,
  );
  expect(later.points[0].x).toBeGreaterThan(first.points[0].x + 60);
  expect(later.hollow).toBe(0);
  const graph = await page.locator(".simple-graph").evaluate((node) => ({
    start: Number((node as HTMLElement).dataset.start),
    span: Number((node as HTMLElement).dataset.span),
    width: node.querySelector("canvas")!.getBoundingClientRect().width,
  }));
  const graphBeat =
    graph.start + ((later.points[0].x - 50) / (graph.width - 74)) * graph.span;
  const heardNote = 69 + 12 * Math.log2(later.voices[0].frequency / 440);
  expect(Math.abs(heardNote - (60 + 12 * graphBeat))).toBeLessThan(0.75);
  await page.getByLabel("Equation expression").fill("6.25");
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeCloseTo(440 * 2 ** ((66.25 - 69) / 12), 0);
  await page
    .getByLabel("Equation expression")
    .fill("12 * floor((x mod 1) / 0.5)");
  const seek = async (beat: number) => {
    const canvas = page.locator("canvas"),
      box = (await canvas.boundingBox())!;
    await canvas.click({
      position: { x: 50 + (beat / 8) * (box.width - 74), y: box.height / 2 },
    });
  };
  await seek(0.05);
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeCloseTo(261.626, 0);
  await seek(0.6);
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeCloseTo(523.251, 0);
  await page.getByLabel("Equation expression").fill("0 { x mod 1 < 0.5 }");
  await seek(0.6);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeLessThan(0.00001);
  await expect.poll(async () => (await state()).points.length).toBe(0);
  await seek(0.05);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeGreaterThan(0.07);
  await page.getByLabel("Equation expression").fill("0");
  await page.getByLabel("New sound instrument").selectOption("bass");
  await page.getByRole("button", { name: "Add sound", exact: true }).click();
  await page.getByLabel("Equation expression").fill("M(x) + 6.25");
  await expect.poll(async () => (await state()).voices.length).toBe(2);
  await expect
    .poll(async () => (await state()).voices[1].frequency)
    .toBeCloseTo(440 * 2 ** ((42.25 - 69) / 12), 0);
  await expect.poll(async () => (await state()).points.length).toBe(2);
  await page
    .getByRole("button", { name: "Mute Melody M", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeLessThan(0.00001);
  await expect.poll(async () => (await state()).points.length).toBe(1);
  expect((await state()).voices[1].gain).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Solo Melody M", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).voices[1].gain)
    .toBeLessThan(0.00001);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeGreaterThan(0.07);
  expect((await state()).voices).toHaveLength(2);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByLabel("Loop length").selectOption("4");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const downloaded = await downloading;
  const wav = await readFile((await downloaded.path())!);
  expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
  const rate = wav.readUInt32LE(24),
    channels = wav.readUInt16LE(22);
  expect((wav.length - 44) / (rate * channels * 2)).toBeCloseTo(7, 2);
  for (const at of [0.3, 0.6, 1.2, 2.2, 3.5]) {
    let power = 0;
    for (let sample = 0; sample < 1024; sample++) {
      const value =
        wav.readInt16LE(44 + (Math.floor(at * rate) + sample) * channels * 2) /
        32768;
      power += value * value;
    }
    expect(Math.sqrt(power / 1024)).toBeGreaterThan(0.01);
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Detailed view", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Simple view", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await state()).voices.length).toBe(4);
  await page.waitForTimeout(1000);
  expect((await state()).voices).toHaveLength(4);
  expect((await state()).voices[2].stop).toBeUndefined();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
});

test("Detailed audio matches the moving curve, ignores legacy note grids and stays identical across views", async ({
  page,
}) => {
  await page.addInitScript(recordStudioAudio);
  await page.addInitScript(() =>
    localStorage.setItem("wave-function-view", "detailed"),
  );
  const project = newSimpleSong();
  project.bpm = 60;
  const melody = project.tracks[0];
  Object.assign(melody, {
    expression: "6.25",
    waveform: "sine",
    scale: "minor",
    interval: 0.5,
  });
  const muted = makeTrack("bass");
  Object.assign(muted, { name: "Muted bass", symbol: "B", muted: true });
  const visual = makeTrack("synth");
  Object.assign(visual, {
    name: "Graph only",
    symbol: "V",
    mapping: "visual",
    expression: "2",
  });
  const kick = makeTrack("kick");
  Object.assign(kick, { symbol: "K", expression: "0" });
  project.tracks.push(muted, visual, kick);
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "continuous.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel("Equation expression")).toContainText("6.25");
  await expect(page.getByLabel("Note interval")).toHaveCount(0);
  await expect(page.getByLabel("Scale lock")).toHaveCount(0);
  await expect(page.getByLabel("Note length")).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const e = (
        window as unknown as {
          studioAudio: {
            voices: {
              node: OscillatorNode;
              stop?: number;
              target?: AudioNode;
            }[];
            gains: Map<AudioNode, GainNode>;
            points: { x: number; y: number }[];
          };
        }
      ).studioAudio;
      const panel = document.querySelector<HTMLElement>(".graph-panel")!;
      const rect = panel.querySelector("canvas")!.getBoundingClientRect();
      const point = e.points[0];
      const start = Number(panel.dataset.start),
        span = Number(panel.dataset.span);
      const min = Number(panel.dataset.yMin),
        max = Number(panel.dataset.yMax);
      return {
        voices: e.voices.map((v) => ({
          frequency: v.node.frequency.value,
          gain: e.gains.get(v.target!)?.gain.value,
          stop: v.stop,
        })),
        points: e.points,
        beat: point && start + ((point.x - 50) / (rect.width - 74)) * span,
        value:
          point && max - ((point.y - 30) / (rect.height - 70)) * (max - min),
      };
    });
  await expect.poll(async () => (await state()).points.length).toBe(1);
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeCloseTo(440 * 2 ** ((66.25 - 69) / 12), 0);
  const first = await state();
  expect(first.value).toBeCloseTo(6.25, 4);
  expect(first.voices).toHaveLength(2);
  expect(first.voices[1].gain).toBe(0);
  await page.waitForTimeout(1100);
  const later = await state();
  expect(later.voices).toHaveLength(2);
  expect(later.voices[0].stop).toBeUndefined();
  expect(later.points[0].x).toBeGreaterThan(first.points[0].x + 25);
  await page.getByLabel("Equation expression").fill("2 * x");
  await expect(page.getByText("Sampling…", { exact: true })).toHaveCount(0);
  await page.waitForTimeout(200);
  const ramp = await state();
  expect(ramp.value).toBeCloseTo(2 * ramp.beat, 4);
  const heard = 69 + 12 * Math.log2(ramp.voices[0].frequency / 440);
  expect(Math.abs(heard - (60 + ramp.value))).toBeLessThan(0.2);
  await page.getByLabel("Equation expression").fill("6.25");
  await expect
    .poll(async () => (await state()).voices[0].frequency)
    .toBeCloseTo(440 * 2 ** ((66.25 - 69) / 12), 0);
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect.poll(async () => (await state()).points.length).toBe(1);
  expect((await state()).voices).toHaveLength(2);
  expect((await state()).voices[0].stop).toBeUndefined();
  await page
    .getByRole("button", { name: "Detailed view", exact: true })
    .click();
  await expect.poll(async () => (await state()).points.length).toBe(1);
  expect((await state()).voices).toHaveLength(2);
  await page.getByLabel("Equation expression").fill("6.25 { x < 0 }");
  await expect.poll(async () => (await state()).points.length).toBe(0);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeLessThan(0.00001);
  await page.getByLabel("Equation expression").fill("6.25");
  await expect.poll(async () => (await state()).points.length).toBe(1);
  await page.getByRole("button", { name: "Mute Melody", exact: true }).click();
  await expect.poll(async () => (await state()).points.length).toBe(0);
  await expect
    .poll(async () => (await state()).voices[0].gain)
    .toBeLessThan(0.00001);
  await page.getByRole("button", { name: "Mute Melody", exact: true }).click();
  await page.getByLabel("Metronome", { exact: true }).click();
  await expect
    .poll(async () =>
      (await state()).voices.some(
        (v) => v.frequency === 800 || v.frequency === 1200,
      ),
    )
    .toBe(true);
  await expect.poll(async () => (await state()).points.length).toBe(1);
  await page.getByLabel("Metronome", { exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByLabel("Loop end beat").fill("4");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const wav = await readFile((await (await pending).path())!);
  const rate = wav.readUInt32LE(24),
    channels = wav.readUInt16LE(22);
  for (const at of [0.3, 0.6, 1.2, 2.2, 3.5]) {
    let power = 0;
    for (let i = 0; i < 1024; i++)
      power +=
        (wav.readInt16LE(44 + (Math.floor(at * rate) + i) * channels * 2) /
          32768) **
        2;
    expect(Math.sqrt(power / 1024)).toBeGreaterThan(0.01);
  }
});

test("Simple video keeps the whole curve in frame and uses moving sound points", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const frames: { dots: number[]; hollow: number }[] = [];
    (window as unknown as { videoFrames: typeof frames }).videoFrames = frames;
    const originalFill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (...args) {
      if (this.canvas.width === 1920 && args[2] === 1920)
        frames.push({ dots: [], hollow: 0 });
      return originalFill.apply(this, args);
    };
    const originalArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      const frame = frames.at(-1);
      if (this.canvas.width === 1920 && frame) {
        if (args[2] === 6) frame.dots.push(args[0]);
        if (args[2] === 3) frame.hollow++;
      }
      return originalArc.apply(this, args);
    };
  });
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  await page.getByLabel("BPM", { exact: true }).fill("120");
  await page.getByLabel("Loop length").selectOption("4");
  await page.getByLabel("Equation expression").fill("0");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Video Animated graph + audio" })
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const downloaded = await downloading;
  const video = await readFile((await downloaded.path())!);
  expect(video.length).toBeGreaterThan(20000);
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          videoFrames: { dots: number[]; hollow: number }[];
        }
      ).videoFrames,
  );
  expect(frames.length).toBeGreaterThan(30);
  expect(
    frames.every((frame) => frame.hollow === 0 && frame.dots.length <= 1),
  ).toBe(true);
  const points = frames.flatMap((frame) => frame.dots);
  expect(points.length).toBeGreaterThan(8);
  expect(Math.max(...points) - Math.min(...points)).toBeGreaterThan(1500);
  expect(points.every((x, i) => i === 0 || x >= points[i - 1])).toBe(true);
  expect(frames.slice(-20).every((frame) => frame.dots.length === 0)).toBe(
    true,
  );
});
