import { test, expect } from "@playwright/test";

test("mobile sound follows the visible Y range, silences both clipped edges, and resumes without restarting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "8");
    if (!localStorage.getItem("wf-axis-scales"))
      localStorage.setItem(
        "wf-axis-scales",
        JSON.stringify({ x: 8.4, y: 2.94 }),
      );
    const evidence = {
      starts: 0,
      context: undefined as AudioContext | undefined,
      gain: undefined as GainNode | undefined,
      lastDot: 0,
      targets: [] as number[],
    };
    (window as unknown as { visibleAudio: typeof evidence }).visibleAudio =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createOscillator() {
        const node = super.createOscillator();
        const start = node.start.bind(node);
        node.start = (...args) => {
          evidence.starts++;
          start(...args);
        };
        return node;
      }
      createGain() {
        const node = super.createGain();
        evidence.gain = node;
        const target = node.gain.setTargetAtTime.bind(node.gain);
        node.gain.setTargetAtTime = (...args) => {
          evidence.targets.push(args[0]);
          return target(...args);
        };
        return node;
      }
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (args[2] === 6) evidence.lastDot = performance.now();
      return arc.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const a = (
        window as unknown as {
          visibleAudio: {
            starts: number;
            gain: GainNode;
            lastDot: number;
            targets: number[];
          };
        }
      ).visibleAudio;
      return {
        starts: a.starts,
        gain: a.gain.gain.value,
        dotAge: performance.now() - a.lastDot,
        targets: a.targets,
      };
    });
  const yScale = async (value: string) => {
    await page
      .getByRole("button", { name: "Edit Y scale", exact: true })
      .click();
    await page.getByLabel("Y scale value", { exact: true }).fill(value);
    await page.getByLabel("Y scale value", { exact: true }).press("Enter");
  };
  const equation = async (value: string) => {
    await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .click();
    await page.getByLabel("Equation expression").fill(value);
    await page.getByLabel("Equation expression").press("Escape");
  };
  const silent = async () => {
    await expect.poll(async () => (await state()).gain).toBeLessThan(0.00001);
    await expect.poll(async () => (await state()).dotAge).toBeGreaterThan(100);
    // Verify actual signal silence, rather than only the gain target.
    const rms = await page.evaluate(async () => {
      const a = (
        window as unknown as {
          visibleAudio: { context: AudioContext; gain: GainNode };
        }
      ).visibleAudio;
      const analyser = a.context.createAnalyser();
      a.gain.connect(analyser);
      analyser.connect(a.context.destination);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const values = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(values);
      a.gain.disconnect(analyser);
      analyser.disconnect();
      return Math.sqrt(
        values.reduce((sum, value) => sum + value * value, 0) / values.length,
      );
    });
    expect(rms).toBeLessThan(0.00001);
  };
  const audible = async () => {
    await expect.poll(async () => (await state()).gain).toBeGreaterThan(0.1);
    await expect.poll(async () => (await state()).dotAge).toBeLessThan(100);
  };

  await silent(); // +8 is above the screenshot's Y = 2.94 frame.
  await yScale("10");
  await audible();
  await yScale("2.94");
  await silent();
  await equation("-8");
  await silent(); // The bottom edge uses the same rule.
  await yScale("10");
  await audible();
  await yScale("0");
  await silent();
  await equation("0");
  await silent(); // Zero shows axes only, so there is no audible point.
  await yScale("2.94");
  await audible();

  // The screenshot's equation must naturally alternate between sound and
  // silence as the clock traverses its clipped arcs, without manual seeking.
  await page.evaluate(() => {
    (
      window as unknown as { visibleAudio: { targets: number[] } }
    ).visibleAudio.targets = [];
  });
  await equation("8 * (2 * sqrt(max(0, 1 - (2 * frac(x) - 1)^2)) - 1)");
  await expect
    .poll(async () => {
      const targets = (await state()).targets;
      return targets.reduce(
        (count, level, index) =>
          count + (index > 0 && level > 0 !== targets[index - 1] > 0 ? 1 : 0),
        0,
      );
    })
    .toBeGreaterThanOrEqual(4);
  expect((await state()).starts).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await equation("8");
  await page.reload();
  await expect(page.locator(".graph-panel")).toHaveAttribute(
    "data-y-max",
    "2.94",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await silent();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});
