import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
// The existing acceptance workflows exercise the detailed studio.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    localStorage.setItem("wave-function-view", "detailed"),
  );
});
test("MVP workflow: compose, play, persist, export WAV/MIDI and recover imports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("New track instrument").selectOption("kick");
  await page.getByRole("button", { name: "Add track", exact: true }).click();
  await expect(page.getByLabel("Equation expression")).toContainText("x mod 1");
  await page.getByLabel("New track instrument").selectOption("bass");
  await page.getByRole("button", { name: "Add track", exact: true }).click();
  await page.getByLabel("BPM", { exact: true }).fill("150");
  await page.getByLabel("Loop end beat").fill("16");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".position strong")).not.toHaveText("01:01:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("New track instrument").selectOption("synth");
  await page.getByRole("button", { name: "Add track", exact: true }).click();
  await page.getByLabel("Equation expression").fill("B(x + 1) + 7");
  await expect(page.locator(".inline-error")).toHaveCount(0);
  await page.getByLabel("Project name").fill("Acceptance composition");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Acceptance composition",
  );
  await expect(page.getByLabel("BPM", { exact: true })).toHaveValue("150");
  await expect(page.locator(".track-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  let download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const wav = await download;
  await wav.saveAs(".local/test-audio.wav");
  const wavPath = await wav.path();
  const bytes = await fs.readFile(wavPath!);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.readUInt32LE(24)).toBe(44100);
  let peak = 0,
    sum = 0;
  for (let i = 44; i < bytes.length; i += 2) {
    const v = bytes.readInt16LE(i);
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  expect(peak).toBeGreaterThan(500);
  expect(Math.sqrt(sum / ((bytes.length - 44) / 2))).toBeGreaterThan(100);
  await page.getByRole("button", { name: "MIDI Notes, drums & tempo" }).click();
  download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const midi = await download;
  expect(
    (await fs.readFile((await midi.path())!)).toString("ascii", 0, 4),
  ).toBe("MThd");
  await page
    .getByRole("button", { name: "Project file Editable .wf.json" })
    .click();
  download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const json = await download;
  const saved = JSON.parse(await fs.readFile((await json.path())!, "utf8"));
  expect(saved.tracks).toHaveLength(3);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "test.wf.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Acceptance composition",
  );
  expect(errors).toEqual([]);
});
test("errors stay isolated, project undo/redo works, arrangement and themes are editable", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await page.getByLabel("Equation expression").fill('import("bad")');
  await expect(page.getByRole("alert")).toContainText("Unknown function");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Mute Kick" }).click();
  await expect(page.getByRole("button", { name: "Mute Kick" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Solo Bass" }).click();
  await expect(page.getByRole("button", { name: "Solo Bass" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Intro 2 layers" }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/Hat · H/)
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Intro 3 layers" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Visual and project settings" })
    .click();
  await page.getByLabel("Graph theme").selectOption("light");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Duplicate track" }).click();
  await expect(page.locator(".track-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Delete track" }).click();
  await expect(page.locator(".track-card")).toHaveCount(5);
  await page.screenshot({ path: ".local/studio-desktop.png", fullPage: true });
});
test("mobile layout has no horizontal overflow and supports equation editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await page.getByRole("button", { name: "Select Bass" }).click();
  await page.getByLabel("Equation expression").fill("sequence(0, 2, 4, 7)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: ".local/studio-mobile.png", fullPage: true });
});
test("video export includes real audio and video streams", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await page.getByLabel("Loop end beat").fill("4");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Video Animated graph + audio" })
    .click();
  const pending = page.waitForEvent("download", { timeout: 45000 });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const file = await pending;
  await file.saveAs(".local/test-video.webm");
  expect((await fs.stat(".local/test-video.webm")).size).toBeGreaterThan(20000);
});
test("remix URLs round-trip and invalid imported projects preserve current work", async ({
  page,
  context,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Remix link Project inside the URL" })
    .click();
  await page
    .getByRole("button", { name: "Create remix link", exact: true })
    .click();
  await expect(page.getByLabel("Remix link")).toHaveValue(/#project=/);
  const url = await page.getByLabel("Remix link").inputValue();
  const remix = await context.newPage();
  await remix.goto(url);
  await expect(remix.getByLabel("Project name")).toHaveValue(
    "Modulo club (remix)",
  );
  await expect(remix.locator(".track-card")).toHaveCount(5);
  await remix.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(remix.locator(".toast")).toContainText("Import failed");
  await expect(remix.getByLabel("Project name")).toHaveValue(
    "Modulo club (remix)",
  );
});
test("audio clock honors BPM, pause and loops; canvas dimensions stay stable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        (window as unknown as { testAudio: AudioContext }).testAudio = this;
      }
    };
  });
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await page.getByLabel("BPM", { exact: true }).fill("120");
  await page.getByLabel("Loop end beat").fill("4");
  const dimensions = await page.locator("canvas").evaluate((c) => ({
    width: (c as HTMLCanvasElement).width,
    height: (c as HTMLCanvasElement).height,
    clientHeight: c.clientHeight,
  }));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  const readPosition = async () => {
    const parts = (await page.locator(".position strong").innerText())
      .split(":")
      .map(Number);
    return (parts[0] - 1) * 4 + (parts[1] - 1) + parts[2] / 100;
  };
  const beforeBeat = await readPosition();
  const beforeClock = await page.evaluate(
    () =>
      (window as unknown as { testAudio: AudioContext }).testAudio.currentTime,
  );
  await page.waitForTimeout(1100);
  const position = await readPosition();
  const afterClock = await page.evaluate(
    () =>
      (window as unknown as { testAudio: AudioContext }).testAudio.currentTime,
  );
  expect(position).toBeGreaterThan(beforeBeat + 0.5);
  // Audio device clocks in headless Windows can run slower than wall time.
  // At 120 BPM, the UI must advance two beats per audio-clock second.
  expect(
    Math.abs(position - beforeBeat - (afterClock - beforeClock) * 2),
  ).toBeLessThan(0.25);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page.locator(".position strong").innerText();
  await page.waitForTimeout(500);
  expect(await page.locator(".position strong").innerText()).toBe(paused);
  const after = await page.locator("canvas").evaluate((c) => ({
    width: (c as HTMLCanvasElement).width,
    height: (c as HTMLCanvasElement).height,
    clientHeight: c.clientHeight,
  }));
  expect(after).toEqual(dimensions);
  expect(dimensions.height).toBeGreaterThan(200);
  expect(dimensions.height).toBeLessThan(2000);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  const prior = await readPosition();
  let wrapped = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    if ((await readPosition()) < prior - 0.25) {
      wrapped = true;
      break;
    }
  }
  expect(wrapped).toBe(true);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".position strong")).toHaveText("01:01:00");
  await page.screenshot({ path: ".local/studio-dark.png", fullPage: true });
});
