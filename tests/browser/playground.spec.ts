import { test, expect } from "@playwright/test";

test("bounded branches edit, persist and sound only where the graph is defined", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-axis-scales", JSON.stringify({ y: 16 }));
    const evidence = {
      starts: 0,
      gain: undefined as GainNode | undefined,
      oscillator: undefined as OscillatorNode | undefined,
    };
    (window as unknown as { boundsAudio: typeof evidence }).boundsAudio =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
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
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Add bounds", exact: true }).click();
  await page.getByLabel("Branch 1 expression", { exact: true }).fill("12");
  await page.getByLabel("Branch 1 bound", { exact: true }).fill("-2 <= x < 0");
  await page
    .getByRole("button", { name: "Remove branch 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  await page.getByLabel("Branch 2 expression", { exact: true }).fill("-12");
  await page.getByLabel("Branch 2 bound", { exact: true }).fill("1 <= x < 3");
  await expect(page.getByRole("alert")).toHaveCount(0);
  for (const width of [1366, 320]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 720 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(width === 1366 ? 768 : 720);
    await expect(
      page.getByLabel("Branch 2 bound", { exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Branch 2 bound", { exact: true }).press("Enter");
  await expect(page.getByLabel("Rendered equation")).toContainText("if");
  await expect(page.getByLabel("Rendered equation")).not.toContainText(
    "otherwise",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const gain = () =>
    page.evaluate(
      () =>
        (window as unknown as { boundsAudio: { gain: GainNode } }).boundsAudio
          .gain.gain.value,
    );
  const frequency = () =>
    page.evaluate(
      () =>
        (window as unknown as { boundsAudio: { oscillator: OscillatorNode } })
          .boundsAudio.oscillator.frequency.value,
    );
  await expect.poll(gain).toBeLessThan(0.001); // x = 0 is outside both bounds.
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  const seek = async (x: number) =>
    canvas.click({
      position: { x: 24 + ((x + 4) / 8) * (box.width - 48), y: box.height / 2 },
    });
  await seek(-1);
  await expect.poll(gain).toBeGreaterThan(0.11);
  await expect.poll(frequency).toBeCloseTo(523.251, 0);
  await seek(0.25);
  await expect.poll(gain).toBeLessThan(0.001);
  await seek(1.5);
  await expect.poll(gain).toBeGreaterThan(0.11);
  await expect.poll(frequency).toBeCloseTo(130.813, 0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { boundsAudio: { starts: number } }).boundsAudio
          .starts,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await expect(page.getByLabel("Branch 1 bound", { exact: true })).toHaveValue(
    "-2 <= x < 0",
  );
  // Clearing a condition must remain editable, rather than becoming otherwise.
  await page.getByLabel("Branch 1 bound", { exact: true }).fill("");
  await expect(page.getByRole("alert")).toContainText("condition");
  await page.getByLabel("Branch 1 bound", { exact: true }).fill("-2 <= x < 0");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit as text", exact: true }).click();
  await page.getByRole("button", { name: "Edit bounds", exact: true }).click();
  await expect(page.getByLabel("Branch 1 bound", { exact: true })).toHaveValue(
    "-2 <= x < 0",
  );
  await page.getByRole("button", { name: "Edit as text", exact: true }).click();
  await page
    .getByLabel("Equation expression")
    .fill("4 * sin(x) { -2 <= x < 2 }");
  await page.getByLabel("Equation expression").press("Escape");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Rendered equation")).toContainText("sin");
});

test("homepage dice, corner links and saved theme work without interrupting sound", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as unknown as { voiceStarts: number }).voiceStarts = 0;
    window.AudioContext = class extends Original {
      createOscillator() {
        const oscillator = super.createOscillator(),
          start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => {
          (window as unknown as { voiceStarts: number }).voiceStarts++;
          start(...args);
        };
        return oscillator;
      }
    };
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const portfolio = page.getByRole("link", { name: "alexyoon.com" });
  await expect(portfolio).toHaveAttribute("href", "https://alexyoon.com");
  await expect(
    page.getByRole("button", { name: "Light mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  let previous = await page.evaluate(() =>
    localStorage.getItem("wf-one-equation"),
  );
  for (let roll = 0; roll < 32; roll++) {
    if (roll === 16) await page.setViewportSize({ width: 390, height: 720 });
    await page.getByRole("button", { name: "Random equation" }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("wf-one-equation")))
      .not.toBe(previous);
    previous = await page.evaluate(() =>
      localStorage.getItem("wf-one-equation"),
    );
    await expect(page.getByLabel("Rendered equation")).not.toBeEmpty();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(roll < 16 ? 1366 : 390);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(roll < 16 ? 768 : 720);
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator(".equation-page")).toHaveCSS(
    "background-color",
    "rgb(21, 21, 21)",
  );
  // Check the actual rendered canvas, including light curve/axis pixels.
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let light = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 180) light++;
        return data[0] === 21 && light > 100;
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { voiceStarts: number }).voiceStarts,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  if (
    await page
      .getByRole("button", { name: "Edit as text", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Edit as text", exact: true })
      .click();
  await expect(page.getByLabel("Equation expression")).toHaveText(previous!);
  await page.getByLabel("Equation expression").fill("6 * cos(x)");
  await expect(page.locator(".cm-content span").first()).toHaveCSS(
    "color",
    "rgb(238, 238, 238)",
  );
  await page.getByLabel("Equation expression").press("Escape");
  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 720 });
    const corners = await page.evaluate(() => {
      const link = document
        .querySelector(".equation-footer a")!
        .getBoundingClientRect();
      const theme = document
        .querySelector(".equation-theme")!
        .getBoundingClientRect();
      return {
        linkX: link.left,
        linkY: link.top,
        themeRight: theme.right,
        themeY: theme.top,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
    });
    expect(corners.width).toBeLessThanOrEqual(width);
    expect(corners.height).toBeLessThanOrEqual(width === 1366 ? 768 : 720);
    expect(corners.linkX).toBeLessThan(40);
    expect(corners.linkY).toBeGreaterThan((width === 1366 ? 768 : 720) - 70);
    expect(corners.themeRight).toBeGreaterThan(width - 40);
    expect(corners.themeY).toBeGreaterThan((width === 1366 ? 768 : 720) - 70);
  }
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await expect(page.locator(".equation-page")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
});

test("a slow initial graph download cannot start sound before the curve is ready", async ({
  page,
}) => {
  await page.route(/graph\.worker/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5500));
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await expect
    .poll(() =>
      page.locator(".simple-graph").getAttribute("data-y-max").then(Number),
    )
    .toBeGreaterThan(4.9);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

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
  await expect
    .poll(() =>
      page.locator(".simple-graph").getAttribute("data-y-max").then(Number),
    )
    .toBeGreaterThan(4.9);
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
  await page.getByRole("button", { name: "Home Page", exact: true }).click();
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
    localStorage.setItem("wf-axis-scales", JSON.stringify({ y: 16 }));
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
  await expect
    .poll(() =>
      page.locator(".simple-graph").getAttribute("data-y-max").then(Number),
    )
    .toBeGreaterThan(4.9);
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
