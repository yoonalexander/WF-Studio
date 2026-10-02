import { test, expect } from "@playwright/test";

test("one equation is the default, with song studio isolated and saved songs preserved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("wave-function-view") === null)
      localStorage.setItem("wave-function-view", "detailed");
  });
  await page.goto("/");
  await expect(page.locator(".equation-page")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Add sound" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Examples", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByLabel("Equation expression").fill("7 * sin(x)");
  await page.getByLabel("Equation expression").press("Escape");
  await expect(page.getByLabel("Rendered equation")).toContainText("7");
  await page.getByRole("link", { name: "Song studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator(".tracks-panel")).toBeVisible();
  await page.getByLabel("Project name").fill("My preserved song");
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add sound", exact: true }),
  ).toBeVisible();
  await page.getByLabel("New sound instrument").selectOption("kick");
  await page.getByRole("button", { name: "Add sound", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(2);
  await page.getByRole("button", { name: "One equation", exact: true }).click();
  await expect(page.getByLabel("Rendered equation")).toContainText("7");
  await page.reload();
  await expect(page.locator(".equation-page")).toBeVisible();
  await expect(page.getByLabel("Rendered equation")).toContainText("7");
  await page.getByRole("link", { name: "Song studio" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "My preserved song",
  );
  await expect(page.locator(".simple-sound")).toHaveCount(2);
  await page.goBack();
  await expect(page.locator(".equation-page")).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "My preserved song",
  );
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "My preserved song",
  );
});

test("the equation controls one sustained oscillator, without repeated note starts or audio gaps", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const evidence = {
      starts: 0,
      stops: 0,
      oscillator: undefined as OscillatorNode | undefined,
      context: undefined as AudioContext | undefined,
      gain: undefined as GainNode | undefined,
    };
    (
      window as unknown as { continuousEvidence: typeof evidence }
    ).continuousEvidence = evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node),
          stop = node.stop.bind(node);
        evidence.oscillator = node;
        node.start = (...args) => {
          evidence.starts++;
          start(...args);
        };
        node.stop = (...args) => {
          evidence.stops++;
          stop(...args);
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
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByLabel("Equation expression").fill("0");
  await page.getByLabel("Equation expression").press("Escape");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  const audio = await page.evaluate(async () => {
    const evidence = (
      window as unknown as {
        continuousEvidence: {
          starts: number;
          stops: number;
          oscillator: OscillatorNode;
          context: AudioContext;
          gain: GainNode;
        };
      }
    ).continuousEvidence;
    const analyser = evidence.context.createAnalyser();
    analyser.fftSize = 2048;
    evidence.gain.connect(analyser);
    analyser.connect(evidence.context.destination);
    const data = new Float32Array(analyser.fftSize),
      levels: number[] = [];
    // Wait for the analyser's first complete audio buffer, using actual signal.
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      analyser.getFloatTimeDomainData(data);
      if (
        Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length) > 0.04
      )
        break;
    }
    const startedAt = evidence.context.currentTime;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      analyser.getFloatTimeDomainData(data);
      levels.push(
        Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length),
      );
    }
    evidence.gain.disconnect(analyser);
    analyser.disconnect();
    return {
      starts: evidence.starts,
      stops: evidence.stops,
      minimumRms: Math.min(...levels),
      frequency: evidence.oscillator.frequency.value,
      audioSeconds: evidence.context.currentTime - startedAt,
    };
  });
  expect(audio.starts).toBe(1);
  expect(audio.stops).toBe(0);
  expect(audio.minimumRms).toBeGreaterThan(0.04);
  expect(audio.audioSeconds).toBeGreaterThan(0.2);
  expect(audio.frequency).toBeCloseTo(261.625565, 1);
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByLabel("Equation expression").fill("12");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              continuousEvidence: { oscillator: OscillatorNode };
            }
          ).continuousEvidence.oscillator.frequency.value,
      ),
    )
    .toBeCloseTo(audio.frequency * 2, 0);
  await page.getByLabel("Equation expression").fill("6.25");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              continuousEvidence: { oscillator: OscillatorNode };
            }
          ).continuousEvidence.oscillator.frequency.value,
      ),
    )
    .toBeCloseTo(audio.frequency * 2 ** (6.25 / 12), 0);
  await page.getByLabel("Equation expression").fill('import("bad")');
  await expect(page.getByRole("alert")).toContainText("Unknown function");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { continuousEvidence: { gain: GainNode } })
            .continuousEvidence.gain.gain.value,
      ),
    )
    .toBeLessThan(0.001);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const e = (
        window as unknown as {
          continuousEvidence: { starts: number; stops: number };
        }
      ).continuousEvidence;
      return { starts: e.starts, stops: e.stops };
    }),
  ).toEqual({ starts: 1, stops: 1 });
  await page.getByLabel("Equation expression").fill("4 * sin(x * pi / 2)");
  await page.getByLabel("Equation expression").press("Escape");
  await page.screenshot({
    path: ".local/one-equation-desktop.png",
    fullPage: true,
  });
});

test("one equation fits desktop and mobile frames and supports long math input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Edit equation", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator(".simple-graph").getAttribute("data-start"))
    .toBe("-4");
  await expect(page.locator(".simple-graph")).toHaveAttribute("data-span", "8");
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .click();
    await page
      .getByLabel("Equation expression")
      .fill(
        "piecewise(x mod 2 < 0.5, 3 * (1 - 2 * abs(2 * (6*x mod 1))), x mod 2 < 1.2, -1.2, 2.2 * (2*x - floor(2*x + 0.5)))",
      );
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByLabel("Equation expression").press("Escape");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(720);
  }
  await page.screenshot({
    path: ".local/one-equation-mobile.png",
    fullPage: true,
  });
});
