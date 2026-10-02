import { test, expect } from "@playwright/test";

test("simple view edits the same project, keeps playback running across views and remembers the view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await expect(page.locator(".simple-app")).toBeVisible();
  await expect(page.locator(".tracks-panel")).toHaveCount(0);
  await expect(page.getByText("Saved on this device")).toBeAttached();
  await page
    .getByLabel("Equation expression")
    .fill(
      "3.2 * exp(-0.5 * floor(x mod 4)) * (1 - (2 * (x mod 1) - 1)^2) - 1.6",
    );
  await expect(page.getByLabel("Rendered equation")).toContainText("3.2");
  await expect(page.getByText("Sampling…", { exact: true })).toHaveCount(0);
  const canvas = page.locator("canvas");
  const dimensions = await canvas.boundingBox();
  expect(dimensions!.height).toBeGreaterThan(300);
  const colors = await canvas.evaluate((c) => {
    const canvas = c as HTMLCanvasElement;
    const data = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let white = 0,
      black = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255)
        white++;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 210) black++;
    }
    return { white: white / (data.length / 4), black };
  });
  expect(colors.white).toBeGreaterThan(0.95);
  expect(colors.black).toBeGreaterThan(1000);
  await page.screenshot({ path: ".local/simple-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Detailed view" }).click();
  await expect(page.getByLabel("Equation expression")).toContainText("3.2");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".track-card")).toHaveCount(5);
  await page.getByLabel("Equation expression").fill("sin(x)");
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect(page.getByLabel("Equation expression")).toContainText("sin(x)");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Equation expression").fill('import("bad")');
  await expect(page.getByRole("alert")).toContainText("Unknown function");
  await page.getByLabel("Equation expression").fill("sin(x)");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Saved on this device")).toBeAttached();
  await page.reload();
  await expect(page.locator(".simple-app")).toBeVisible();
  await expect(page.getByLabel("Equation expression")).toContainText("sin(x)");
  await page.getByRole("button", { name: "Detailed view" }).click();
  await page.reload();
  await expect(page.locator(".tracks-panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("simple view fits small screens, selects equations and handles an empty project", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeAttached();
  await page
    .getByRole("button", { name: "Select Bass B", exact: true })
    .click();
  await page
    .getByLabel("Equation expression")
    .fill("piecewise(x mod 2 < 1, sin(x), 0)");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Sampling…", { exact: true })).toHaveCount(0);
  const bounds = await page.getByLabel("Equation expression").boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/simple-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Detailed view" }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await page.getByRole("button", { name: "Add your first equation" }).click();
  await expect(page.getByLabel("Equation expression")).toContainText(
    "sequence(",
  );
});

test("compose from scratch in simple mode, fit the whole loop and show actual oscillator activity", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    const evidence = window as unknown as {
      testAudio: AudioContext;
      testVoices: { start: number; end: number; node: OscillatorNode }[];
    };
    evidence.testVoices = [];
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        evidence.testAudio = this;
        const create = this.createOscillator.bind(this);
        this.createOscillator = () => {
          const node = create(),
            record = { start: Infinity, end: Infinity, node };
          const start = node.start.bind(node),
            stop = node.stop.bind(node);
          node.start = (when = 0) => {
            record.start = when;
            evidence.testVoices.push(record);
            start(when);
          };
          node.stop = (when = 0) => {
            record.end = when;
            stop(when);
          };
          return node;
        };
      }
    };
  });
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("My song");
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  await page.getByLabel("Project name").fill("My first loop");
  await page.getByLabel("Equation expression").fill("12 * sin(x * pi / 2)");
  await page.getByLabel("Note interval").selectOption("1");
  await expect(page.getByText("Sampling…", { exact: true })).toHaveCount(0);
  const fitted = await page.locator(".simple-graph").evaluate((e) => ({
    start: Number((e as HTMLElement).dataset.start),
    span: Number((e as HTMLElement).dataset.span),
    min: Number((e as HTMLElement).dataset.yMin),
    max: Number((e as HTMLElement).dataset.yMax),
  }));
  expect(fitted).toMatchObject({ start: 0, span: 8 });
  expect(fitted.min).toBeLessThan(-12);
  expect(fitted.max).toBeGreaterThan(12);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const e = window as unknown as {
          testAudio: AudioContext;
          testVoices: { start: number; end: number }[];
        };
        const active = e.testVoices.some(
          (v) =>
            v.start <= e.testAudio.currentTime &&
            v.end > e.testAudio.currentTime,
        );
        return (
          active &&
          document
            .querySelector(".simple-sound")
            ?.getAttribute("data-sound-state")
            ?.startsWith("Playing")
        );
      }),
    )
    .toBe(true);
  await expect
    .poll(() => page.locator(".simple-sound").getAttribute("data-sound-state"))
    .toBe("Between notes");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.getByLabel("New sound instrument").selectOption("kick");
  await page.getByRole("button", { name: "Add sound", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(2);
  await page.getByLabel("Equation expression").fill("pulse(1, 0.1)");
  await page.getByRole("button", { name: "Mute Kick K", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select Kick K" }),
  ).toContainText("Muted");
  await page.getByRole("button", { name: "Solo Kick K", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mute Kick K" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Select Melody M" }),
  ).toContainText("Other sound soloed");
  await page.getByLabel("Loop length").selectOption("4");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => page.getByRole("button", { name: "Select Kick K" }).innerText())
    .toContain("Playing");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const e = window as unknown as {
          testAudio: AudioContext;
          testVoices: { start: number; end: number; node: OscillatorNode }[];
        };
        const active = e.testVoices.filter(
          (v) =>
            v.start <= e.testAudio.currentTime &&
            v.end > e.testAudio.currentTime,
        );
        return (
          active.length > 0 && active.every((v) => v.node.frequency.value < 151)
        );
      }),
    )
    .toBe(true);
  await expect(page.locator(".simple-graph")).toHaveAttribute(
    "data-start",
    "0",
  );
  await expect(page.locator(".simple-graph")).toHaveAttribute("data-span", "4");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove Kick K", exact: true })
    .click();
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(2);
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("My first loop");
  await expect(page.locator(".simple-sound")).toHaveCount(2);
  await expect(page.getByLabel("Loop length")).toHaveValue("4");
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.locator(".simple-graph")).toHaveAttribute("data-span", "4");
  await expect
    .poll(() =>
      page.locator(".simple-graph").getAttribute("data-y-max").then(Number),
    )
    .toBeGreaterThan(12);
  const composerBottom = await page
    .locator(".simple-bottom")
    .evaluate((e) => e.getBoundingClientRect().bottom);
  expect(composerBottom).toBeLessThanOrEqual(768);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  await page.screenshot({ path: ".local/simple-composer.png", fullPage: true });
});

test("examples explain every layer and imported sections stay visible until explicitly removed", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  for (const name of ["Modulo club", "Sine garden", "Piecewise playground"]) {
    await page.getByRole("button", { name: "Examples", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.getByLabel("Loop length")).toHaveValue("8");
    await expect(page.locator(".simple-arrangement-notice")).toHaveCount(0);
    await expect(page.getByText(/Starts at x/)).toHaveCount(0);
    await expect(page.getByText("Saved on this device")).toBeVisible();
  }
  await page.getByRole("button", { name: "Detailed view" }).click();
  await page.getByRole("button", { name: "Examples", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Modulo club/ })
    .click();
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select Lead L" }),
  ).toContainText("Starts at x = 32");
  await page.getByRole("button", { name: "Play all sounds together" }).click();
  await expect(
    page.getByRole("button", { name: "Select Lead L" }),
  ).toContainText("Ready");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select Lead L" }),
  ).toContainText("Starts at x = 32");
});
