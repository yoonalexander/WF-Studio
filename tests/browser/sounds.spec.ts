import { test, expect } from "@playwright/test";

test("sound wheel and expanded choices change real audio while keeping one continuous voice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const evidence = {
      starts: 0,
      context: undefined as AudioContext | undefined,
      gain: undefined as GainNode | undefined,
      oscillator: undefined as OscillatorNode | undefined,
    };
    (window as unknown as { soundAudio: typeof evidence }).soundAudio =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createGain() {
        const node = super.createGain();
        evidence.gain = node;
        return node;
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
    };
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const status = page.locator(".sound-picker [role=status]");
  await expect(status).toHaveText("Sound: Electro lead");
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByLabel("Equation expression").fill("0");
  await page.getByLabel("Equation expression").press("Enter");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const a = (
        window as unknown as {
          soundAudio: {
            oscillator: OscillatorNode;
            context: AudioContext;
            starts: number;
            gain: GainNode;
          };
        }
      ).soundAudio;
      return {
        type: a.oscillator.type,
        frequency: a.oscillator.frequency.value,
        time: a.context.currentTime,
        starts: a.starts,
        gain: a.gain.gain.value,
      };
    });
  const harmonics = () =>
    page.evaluate(async () => {
      const a = (
        window as unknown as {
          soundAudio: {
            gain: GainNode;
            context: AudioContext;
            oscillator: OscillatorNode;
          };
        }
      ).soundAudio;
      const analyser = a.context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      a.gain.connect(analyser);
      analyser.connect(a.context.destination);
      await new Promise((resolve) => setTimeout(resolve, 350));
      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);
      const bin =
        (a.oscillator.frequency.value * analyser.fftSize) /
        a.context.sampleRate;
      const peak = (target: number) =>
        Math.max(
          ...Array.from(
            data.slice(Math.round(target) - 2, Math.round(target) + 3),
          ),
        );
      const fundamental = peak(bin),
        third = peak(bin * 3);
      a.gain.disconnect(analyser);
      analyser.disconnect();
      return { fundamental, ratio: 10 ** ((third - fundamental) / 20) };
    });
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(261.626, 0);
  const start = await state();
  expect(start.type).toBe("sawtooth");
  const lead = await harmonics();
  expect(lead.fundamental).toBeGreaterThan(-50);
  expect(lead.ratio).toBeGreaterThan(0.1);
  const volume = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(volume).toHaveValue("100");
  await volume.fill("50");
  await expect.poll(async () => (await state()).gain).toBeCloseTo(0.06, 3);
  const half = await harmonics();
  expect(lead.fundamental - half.fundamental).toBeCloseTo(6.02, 0);
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await expect(volume).toHaveValue("0");
  await expect.poll(async () => (await state()).gain).toBeLessThan(0.00001);
  const silence = await page.evaluate(async () => {
    const a = (
      window as unknown as {
        soundAudio: { gain: GainNode; context: AudioContext };
      }
    ).soundAudio;
    const analyser = a.context.createAnalyser();
    a.gain.connect(analyser);
    analyser.connect(a.context.destination);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    a.gain.disconnect(analyser);
    analyser.disconnect();
    return Math.max(...samples.map(Math.abs));
  });
  expect(silence).toBeLessThan(0.00001);
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(status).toHaveText("Sound: Deep electro");
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(start.frequency / 2, 0);
  expect((await state()).gain).toBeLessThan(0.00001);
  await page
    .getByRole("button", { name: "Previous sound", exact: true })
    .click();
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  await expect(volume).toHaveValue("50");
  await expect.poll(async () => (await state()).gain).toBeCloseTo(0.06, 3);
  await volume.fill("0");
  await expect.poll(async () => (await state()).gain).toBeLessThan(0.00001);
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  await expect(volume).toHaveValue("100");
  await volume.press("ArrowLeft");
  await expect(volume).toHaveValue("99");
  await volume.press("ArrowRight");
  await expect(volume).toHaveValue("100");
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(status).toHaveText("Sound: Deep electro");
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(start.frequency / 2, 0);
  expect((await state()).type).toBe("sawtooth");
  const deep = await harmonics();
  expect(deep.fundamental).toBeGreaterThan(-50);
  expect(deep.ratio).toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(status).toHaveText("Sound: Pulse lead");
  await expect.poll(async () => (await state()).type).toBe("square");
  await page
    .getByRole("button", { name: "Previous sound", exact: true })
    .click();
  await expect(status).toHaveText("Sound: Deep electro");
  await page
    .getByRole("button", { name: "Previous sound", exact: true })
    .click();
  await expect(status).toHaveText("Sound: Electro lead");
  await page.locator(".sound-wheel").hover();
  await page.mouse.wheel(0, 120);
  await expect(status).toHaveText("Sound: Deep electro");
  await page
    .getByRole("button", { name: "Previous sound", exact: true })
    .press("ArrowUp");
  await expect(status).toHaveText("Sound: Electro lead");
  const choose = async (name: string) => {
    await page.getByRole("button", { name: "Expand sound options" }).click();
    await expect(
      page.getByRole("dialog", { name: "Choose a sound" }),
    ).toBeVisible();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Choose a sound" }),
    ).toHaveCount(0);
    await expect(status).toHaveText(`Sound: ${name}`);
  };
  await choose("Warm bass");
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(130.813, 0);
  await choose("Pure sine");
  await expect.poll(async () => (await state()).type).toBe("sine");
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(261.626, 0);
  const sine = await harmonics();
  expect(sine.fundamental).toBeGreaterThan(-50);
  expect(sine.ratio).toBeLessThan(0.02);
  await choose("Glass");
  await expect.poll(async () => (await state()).type).toBe("custom");
  await choose("Soft keys");
  await expect.poll(async () => (await state()).type).toBe("triangle");
  const end = await state();
  expect(end.starts).toBe(1);
  expect(end.time).toBeGreaterThan(start.time);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await volume.fill("35");
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await page.reload();
  await expect(status).toHaveText("Sound: Soft keys");
  await expect(volume).toHaveValue("0");
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  await expect(volume).toHaveValue("35");
  for (const width of [1366, 768, 651, 520, 390, 320]) {
    const height = width === 1366 ? 768 : 720;
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(height);
    const volumeBox = (await volume.boundingBox())!;
    const pickerBox = (await page.locator(".sound-picker").boundingBox())!;
    expect(volumeBox.x).toBeGreaterThan(pickerBox.x + pickerBox.width);
    expect(volumeBox.x + volumeBox.width).toBeLessThanOrEqual(width);
    expect(volumeBox.y).toBeGreaterThan(pickerBox.y);
    expect(volumeBox.y + volumeBox.height).toBeLessThanOrEqual(
      pickerBox.y + pickerBox.height,
    );
    await page.getByRole("button", { name: "Expand sound options" }).click();
    const box = (await page
      .getByRole("dialog", { name: "Choose a sound" })
      .boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await page
      .getByRole("button", { name: "Soft keys", exact: true })
      .press("Escape");
    await expect(
      page.getByRole("button", { name: "Expand sound options" }),
    ).toBeFocused();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Next sound" }).click();
  await expect(page.locator(".sound-wheel-strip")).toHaveCSS(
    "animation-name",
    "none",
  );
});
