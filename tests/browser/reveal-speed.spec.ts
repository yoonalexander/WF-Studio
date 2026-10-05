import { test, expect } from "@playwright/test";
import { newSimpleSong } from "../../src/simple";

test("speed changes the actual audio clock traversal and pitch ramp together without restarting the voice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "2 * x");
    localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 16, y: 48 }));
    const evidence = {
      starts: 0,
      context: undefined as AudioContext | undefined,
      oscillator: undefined as OscillatorNode | undefined,
    };
    (window as unknown as { speedAudio: typeof evidence }).speedAudio =
      evidence;
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
    };
  });
  await page.goto("/");
  const slider = page.getByRole("slider", {
    name: "Playback speed",
    exact: true,
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const a = (
        window as unknown as {
          speedAudio: {
            starts: number;
            context: AudioContext;
            oscillator: OscillatorNode;
          };
        }
      ).speedAudio;
      return {
        starts: a.starts,
        time: a.context.currentTime,
        x: Number(
          document.querySelector("canvas")!.getAttribute("data-position"),
        ),
        note: 69 + 12 * Math.log2(a.oscillator.frequency.value / 440),
      };
    });
  for (const speed of [0.25, 1, 4]) {
    const beforeChange = await state();
    await slider.fill(String(speed));
    const afterChange = await state();
    expect(Math.abs(afterChange.x - beforeChange.x)).toBeLessThan(0.7);
    const first = await state();
    await expect
      .poll(async () => (await state()).time)
      .toBeGreaterThan(first.time + 0.25);
    const next = await state();
    expect((next.x - first.x) / (next.time - first.time)).toBeCloseTo(
      (newSimpleSong().bpm / 60) * speed,
      0,
    );
    expect(Math.abs(next.note - (60 + 2 * next.x))).toBeLessThan(0.5);
    expect(next.starts).toBe(1);
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

test("reveal draws the first pass, persists through loops, and restarts Random from the left without restarting sound", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "2");
    localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 1, y: 5 }));
    const original = window.AudioContext;
    (window as unknown as { voiceStarts: number }).voiceStarts = 0;
    window.AudioContext = class extends original {
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node);
        node.start = (...args) => {
          (window as unknown as { voiceStarts: number }).voiceStarts++;
          start(...args);
        };
        return node;
      }
    };
  });
  await page.goto("/");
  const canvas = page.locator("canvas");
  const reveal = page.getByRole("button", { name: "Reveal mode", exact: true });
  const position = async () =>
    Number(await canvas.getAttribute("data-position"));
  const pixel = (x: number) =>
    canvas.evaluate((node, x) => {
      const c = node as HTMLCanvasElement,
        box = c.getBoundingClientRect(),
        ratio = c.width / box.width;
      const px = 36 + ((x + 1) / 2) * (box.width - 72);
      const py = 30 + (3 / 10) * (box.height - 60);
      const data = c
        .getContext("2d")!
        .getImageData(
          Math.floor((px - 2) * ratio),
          Math.floor((py - 2) * ratio),
          Math.ceil(4 * ratio),
          Math.ceil(4 * ratio),
        ).data;
      return Array.from(data).some((v, i) => i % 4 === 0 && v < 120);
    }, x);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect.poll(() => pixel(0.8)).toBe(true);
  await reveal.click();
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  await expect.poll(position).toBe(-1);
  await expect.poll(() => pixel(0.8)).toBe(false);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(position, { intervals: [20] }).toBeGreaterThan(-0.6);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(() => pixel(-0.8)).toBe(true);
  expect(await pixel(0.8)).toBe(false);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reveal-until", "complete");
  await expect.poll(() => pixel(0.8)).toBe(true);
  // Four later loops must keep the full drawing.
  await page
    .getByRole("slider", { name: "Playback speed", exact: true })
    .fill("4");
  await expect(
    page.getByRole("slider", { name: "Playback speed", exact: true }),
  ).toHaveAttribute("aria-valuetext", "4×");
  await page.waitForTimeout(1200);
  await expect(canvas).toHaveAttribute("data-reveal-until", "complete");
  expect(await pixel(0.8)).toBe(true);
  await page
    .getByRole("slider", { name: "Playback speed", exact: true })
    .fill("0.25");
  await page
    .getByRole("button", { name: "Random equation", exact: true })
    .click();
  await expect.poll(position, { intervals: [20] }).toBeLessThan(-0.7);
  expect(await canvas.getAttribute("data-reveal-until")).not.toBe("complete");
  expect(
    await page.evaluate(
      () => (window as unknown as { voiceStarts: number }).voiceStarts,
    ),
  ).toBe(2); // Pause/resume only.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await reveal.click();
  await expect(canvas).toHaveAttribute("data-reveal-until", "complete");
  await reveal.click();
  await page.reload();
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("slider", { name: "Playback speed", exact: true }),
  ).toHaveValue("0.25");
  await expect.poll(position).toBe(-1);
});

test("the hint stays under the equation and a taller centered graph leaves the X arrow clear on mobile", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("wf-one-equation", "2"));
  await page.goto("/");
  for (const [width, height] of [
    [393, 852],
    [320, 720],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeEnabled();
    const equation = (await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .boundingBox())!;
    const hint = (await page.locator(".equation-hint").boundingBox())!;
    const play = (await page
      .getByRole("button", { name: "Play", exact: true })
      .boundingBox())!;
    const graph = (await page.locator("canvas").boundingBox())!;
    expect(hint.y).toBeGreaterThanOrEqual(equation.y + equation.height - 1);
    expect(hint.y + hint.height).toBeLessThan(play.y);
    expect(graph.height).toBeGreaterThan(width === 393 ? 370 : 280);
    expect(graph.x + graph.width / 2).toBeCloseTo(width / 2, 1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(height);
    if (width === 393)
      await page.screenshot({
        path: ".local/reveal-speed-mobile.png",
        fullPage: true,
      });
    if (width === 1366)
      await page.screenshot({
        path: ".local/reveal-speed-desktop.png",
        fullPage: true,
      });
  }
});
