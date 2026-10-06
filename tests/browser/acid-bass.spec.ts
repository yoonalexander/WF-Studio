import { test, expect } from "@playwright/test";

test("303 Acid bass has a deep sustained saw, resonant equation-driven sweeps, glide, silence and saved selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "0");
    localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 4, y: 24 }));
    const evidence = {
      starts: 0,
      context: undefined as AudioContext | undefined,
      oscillator: undefined as OscillatorNode | undefined,
      filter: undefined as BiquadFilterNode | undefined,
      gain: undefined as GainNode | undefined,
      cutoffs: [] as number[],
    };
    (window as unknown as { acidAudio: typeof evidence }).acidAudio = evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node);
        evidence.oscillator = node;
        node.start = (...args) => {
          evidence.starts++;
          start(...args);
        };
        return node;
      }
      createBiquadFilter() {
        const node = super.createBiquadFilter(),
          target = node.frequency.setTargetAtTime.bind(node.frequency);
        evidence.filter = node;
        node.frequency.setTargetAtTime = (...args) => {
          evidence.cutoffs.push(args[0]);
          return target(...args);
        };
        return node;
      }
      createGain() {
        const node = super.createGain();
        evidence.gain = node;
        return node;
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const choose = async (name: string) => {
    await page
      .getByRole("button", { name: "Expand sound options", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  const state = () =>
    page.evaluate(() => {
      const e = (
        window as unknown as {
          acidAudio: {
            starts: number;
            oscillator: OscillatorNode;
            filter: BiquadFilterNode;
            gain: GainNode;
            cutoffs: number[];
          };
        }
      ).acidAudio;
      return {
        starts: e.starts,
        type: e.oscillator.type,
        frequency: e.oscillator.frequency.value,
        q: e.filter.Q.value,
        cutoff: e.filter.frequency.value,
        gain: e.gain.gain.value,
        cutoffs: e.cutoffs,
      };
    });
  const clear = () =>
    page.evaluate(() => {
      (
        window as unknown as { acidAudio: { cutoffs: number[] } }
      ).acidAudio.cutoffs = [];
    });
  const equation = async (value: string) => {
    await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .click();
    await page.getByLabel("Equation expression").fill(value);
    await page.getByLabel("Equation expression").press("Enter");
  };
  await choose("Warm bass");
  await clear();
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: 303 Acid bass",
  );
  await expect
    .poll(async () => (await state()).cutoffs.some((c) => c > 2500))
    .toBe(true);
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(65.406, 1);
  await expect.poll(async () => (await state()).q).toBeCloseTo(6.5, 1);
  await expect.poll(async () => (await state()).cutoff).toBeLessThan(550);
  expect((await state()).type).toBe("sawtooth");
  await clear();
  // A held equation stays sustained and does not acquire an automatic note grid.
  await page.waitForTimeout(400);
  expect((await state()).cutoffs.every((c) => c < 550)).toBe(true);
  await clear();
  await equation("7");
  await expect
    .poll(async () => (await state()).cutoffs.some((c) => c > 3000))
    .toBe(true);
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(97.999, 1);
  await expect.poll(async () => (await state()).cutoff).toBeLessThan(800);
  const signal = await page.evaluate(async () => {
    const e = (
      window as unknown as {
        acidAudio: { context: AudioContext; gain: GainNode };
      }
    ).acidAudio;
    const analyser = e.context.createAnalyser();
    analyser.fftSize = 4096;
    e.gain.connect(analyser);
    analyser.connect(e.context.destination);
    let peak = 0,
      rms = 0;
    const samples = new Float32Array(analyser.fftSize);
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...samples.map(Math.abs));
      rms = Math.max(
        rms,
        Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length),
      );
    }
    e.gain.disconnect(analyser);
    analyser.disconnect();
    return { peak, rms };
  });
  expect(signal.rms).toBeGreaterThan(0.01);
  expect(signal.peak).toBeLessThan(0.95);
  await equation("7 { x < -100 }");
  await expect.poll(async () => (await state()).gain).toBeLessThan(0.00001);
  await clear();
  await equation("7");
  await expect
    .poll(async () => (await state()).cutoffs.some((c) => c > 3000))
    .toBe(true);
  await expect.poll(async () => (await state()).gain).toBeGreaterThan(0.07);
  expect((await state()).starts).toBe(1);
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await expect.poll(async () => (await state()).gain).toBeLessThan(0.00001);
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: 303 Acid bass",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await state()).q).toBeCloseTo(6.5, 1);
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: Glass",
  );
  await expect.poll(async () => (await state()).q).toBeCloseTo(0.5, 1);
  await expect.poll(async () => (await state()).cutoff).toBeCloseTo(7000, 0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});
