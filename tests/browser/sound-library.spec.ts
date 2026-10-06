import { test, expect } from "@playwright/test";
import { sounds } from "../../src/sounds";

test("the sound library is a searchable, keyboard-accessible grid that fits light, dark and mobile screens", async ({
  page,
}) => {
  await page.goto("/");
  const open = page.getByRole("button", {
    name: "Expand sound options",
    exact: true,
  });
  const dialog = page.getByRole("dialog", { name: "Choose a sound" });
  await open.click();
  await expect(dialog.locator(".sound-option")).toHaveCount(45);
  await expect(
    dialog.getByRole("button", { name: "Electro lead", exact: true }),
  ).toBeFocused();
  expect(
    await dialog
      .locator(".sound-grid")
      .evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(3);
  await dialog.getByRole("button", { name: "Bass", exact: true }).click();
  await expect(dialog.locator(".sound-option")).toHaveCount(
    sounds.filter((s) => s.category === "Bass").length,
  );
  await dialog.getByRole("button", { name: "All", exact: true }).click();
  await dialog
    .getByRole("searchbox", { name: "Search sounds" })
    .fill("Minimoog");
  await expect(dialog.locator(".sound-option")).toHaveCount(2);
  await expect(
    dialog.getByRole("button", { name: "Ladder bass", exact: true }),
  ).toContainText("Inspired by Moog Minimoog.");
  await expect(
    dialog.getByRole("button", { name: "Ladder lead", exact: true }),
  ).toContainText("Inspired by Moog Minimoog.");
  await dialog.getByRole("searchbox", { name: "Search sounds" }).fill("FM");
  await expect(
    dialog.getByRole("button", { name: "FM tine piano", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "FM bell", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Chorus pad", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("searchbox", { name: "Search sounds" })
    .fill("no matching synth");
  await expect(dialog.locator(".sound-empty")).toBeVisible();
  await dialog
    .getByRole("searchbox", { name: "Search sounds" })
    .fill("supersaw");
  await dialog.getByRole("button", { name: "Supersaw", exact: true }).click();
  await expect(open).toBeFocused();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: Supersaw",
  );
  await page.reload();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: Supersaw",
  );
  for (const [width, height, theme] of [
    [1366, 768, "Light"],
    [390, 720, "Light"],
    [320, 568, "Dark"],
    [844, 390, "Dark"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("button", { name: `${theme} mode`, exact: true })
      .click();
    await open.click();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const colors = await dialog.evaluate((e) => ({
      background: getComputedStyle(e).backgroundColor,
      color: getComputedStyle(e).color,
    }));
    expect(colors.background).not.toBe(colors.color);
    await dialog
      .getByRole("button", { name: "Long sub bass", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close sound options", exact: true }),
    ).toBeFocused();
    if (width === 1366 || width === 390) {
      await dialog.locator(".sound-grid").evaluate((e) => {
        e.scrollTop = 0;
      });
      await page.screenshot({ path: `.local/sound-library-${width}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await open.click();
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open.click();
  await expect(dialog).toHaveCSS("animation-name", "none");
});

test("every library sound produces real sustained audio; layered, FM and effect voices follow pitch, mute and equation rests", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "0");
    localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 4, y: 24 }));
    const evidence = {
      context: undefined as AudioContext | undefined,
      output: undefined as GainNode | undefined,
      root: undefined as OscillatorNode | undefined,
      starts: 0,
      active: 0,
    };
    (window as unknown as { libraryAudio: typeof evidence }).libraryAudio =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createGain() {
        const node = super.createGain();
        evidence.output ??= node;
        return node;
      }
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node),
          stop = node.stop.bind(node);
        evidence.root ??= node;
        node.start = (...args) => {
          if (node === evidence.root) evidence.starts++;
          evidence.active++;
          start(...args);
        };
        node.stop = (...args) => {
          evidence.active--;
          stop(...args);
        };
        return node;
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    const e = (
      window as unknown as {
        libraryAudio: {
          context: AudioContext;
          output: GainNode;
          analyser?: AnalyserNode;
        };
      }
    ).libraryAudio;
    e.analyser = e.context.createAnalyser();
    e.analyser.fftSize = 4096;
    e.output.connect(e.analyser);
  });
  const state = () =>
    page.evaluate(() => {
      const e = (
        window as unknown as {
          libraryAudio: {
            root: OscillatorNode;
            starts: number;
            active: number;
            output: GainNode;
          };
        }
      ).libraryAudio;
      return {
        frequency: e.root.frequency.value,
        starts: e.starts,
        active: e.active,
        gain: e.output.gain.value,
      };
    });
  const signal = () =>
    page.evaluate(async () => {
      const e = (
        window as unknown as { libraryAudio: { analyser: AnalyserNode } }
      ).libraryAudio;
      const data = new Float32Array(e.analyser.fftSize);
      let peak = 0,
        rms = 0;
      for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        e.analyser.getFloatTimeDomainData(data);
        peak = Math.max(peak, ...data.map(Math.abs));
        rms = Math.max(
          rms,
          Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length),
        );
      }
      return { peak, rms };
    });
  const choose = async (name: string) => {
    await page
      .getByRole("button", { name: "Expand sound options", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".sound-picker [role=status]")).toHaveText(
      `Sound: ${name}`,
    );
  };
  const equation = async (value: string) => {
    await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .click();
    await page.getByLabel("Equation expression").fill(value);
    await page.getByLabel("Equation expression").press("Enter");
  };
  for (const sound of sounds) {
    await choose(sound.name);
    const output = await signal();
    expect(output.rms, `${sound.name} must be audible`).toBeGreaterThan(0.001);
    expect(output.peak, `${sound.name} must have output headroom`).toBeLessThan(
      0.95,
    );
    expect((await state()).active).toBeLessThanOrEqual(9);
  }
  expect((await state()).starts).toBe(1);
  for (const name of [
    "FM tine piano",
    "Supersaw",
    "Dub techno chord",
    "Vocoder-style voice",
  ]) {
    await choose(name);
    await equation("7");
    const preset = sounds.find((s) => s.name === name)!;
    await expect
      .poll(async () => (await state()).frequency)
      .toBeCloseTo(261.625565 * 2 ** ((7 + preset.octave) / 12), 0);
    await page.getByRole("button", { name: "Mute sound", exact: true }).click();
    await expect.poll(async () => (await signal()).peak).toBeLessThan(0.00001);
    await page
      .getByRole("button", { name: "Unmute sound", exact: true })
      .click();
    await equation("7 { x < -100 }");
    await expect.poll(async () => (await signal()).peak).toBeLessThan(0.00001);
    await equation("7");
    await expect.poll(async () => (await signal()).rms).toBeGreaterThan(0.001);
    // The same master gate also handles defined but vertically clipped values.
    await equation("30");
    await expect.poll(async () => (await signal()).peak).toBeLessThan(0.00001);
    await equation("0");
  }
  await choose("Pure sine");
  await expect.poll(async () => (await state()).active).toBe(1);
  expect((await state()).starts).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await state()).active).toBe(0);
  expect(errors).toEqual([]);
});
