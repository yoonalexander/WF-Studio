import { test, expect, type Page } from "@playwright/test";
import { referenceEquations } from "../../src/reference-equations";

test.describe("mobile knob gestures", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 320, height: 720 },
  });
  test("touch swipes use only horizontal movement, work outside the dial, and reverse immediately at zero", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const touch = await context.newCDPSession(page);
    const point = (x: number, y: number) => ({ x, y, id: 1 });
    const reset = async (axis: "X" | "Y", value = "5") => {
      const box = (await page
        .getByRole("button", { name: `Edit ${axis} scale`, exact: true })
        .boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      const input = page.getByLabel(`${axis} scale value`, { exact: true });
      await expect(input).toBeVisible();
      await input.fill(value);
      await input.press("Enter");
    };
    for (const axis of ["X", "Y"] as const) {
      const dial = page.getByRole("spinbutton", {
        name: `${axis} axis scale`,
        exact: true,
      });
      for (const [dx, dy, expected] of [
        [0, -40, "5"],
        [40, 0, "7.4"],
        [0, 40, "5"],
        [-40, 0, "2.6"],
        [40, 60, "7.4"],
        [-40, -60, "2.6"],
      ] as const) {
        await reset(axis);
        const box = (await dial.boundingBox())!;
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point(x, y)],
        });
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [point(x + dx, y + dy)],
        });
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await expect(dial).toHaveAttribute("aria-valuenow", expected);
        await expect(
          page.getByLabel(`${axis} scale value`, { exact: true }),
        ).toHaveCount(0);
        expect(await page.evaluate(() => scrollY)).toBe(0);
      }
      await reset(axis, "1");
      const box = (await dial.boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point(x, y)],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(x - 40, y)],
      });
      await expect(dial).toHaveAttribute("aria-valuenow", "0");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(x - 30, y)],
      });
      await expect(dial).toHaveAttribute("aria-valuenow", "0.6");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      await reset(axis);
      await expect(dial).toHaveAttribute("aria-valuenow", "5");
    }
    await touch.detach();
  });
});

async function enterScale(page: Page, axis: "X" | "Y", value: string) {
  await page
    .getByRole("button", { name: `Edit ${axis} scale`, exact: true })
    .click();
  const field = page.getByLabel(`${axis} scale value`, { exact: true });
  await field.fill(value);
  await field.press("Enter");
}

test("axis knobs scroll independently, rotate in both directions, stop at zero and preserve continuous audio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "0");
    const evidence = {
      starts: 0,
      oscillator: undefined as OscillatorNode | undefined,
    };
    (window as unknown as { scaleAudio: typeof evidence }).scaleAudio =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() {
        const oscillator = super.createOscillator(),
          start = oscillator.start.bind(oscillator);
        evidence.oscillator = oscillator;
        oscillator.start = (...args) => {
          evidence.starts++;
          start(...args);
        };
        return oscillator;
      }
    };
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const x = page.getByRole("spinbutton", { name: "X axis scale", exact: true });
  const y = page.getByRole("spinbutton", { name: "Y axis scale", exact: true });
  const graph = page.locator(".graph-panel");
  await expect(x).toHaveAttribute("aria-valuenow", "4");
  await expect(y).toHaveAttribute("aria-valuenow", "5");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const audio = () =>
    page.evaluate(() => {
      const a = (
        window as unknown as {
          scaleAudio: { starts: number; oscillator: OscillatorNode };
        }
      ).scaleAudio;
      return { starts: a.starts, frequency: a.oscillator.frequency.value };
    });
  await expect
    .poll(async () => (await audio()).frequency)
    .toBeCloseTo(261.6256, 2);
  const before = await audio();
  await x.hover();
  await page.mouse.wheel(0, -100);
  await expect(x).toHaveAttribute("aria-valuenow", "5");
  await expect(graph).toHaveAttribute("data-start", "-5");
  await expect(graph).toHaveAttribute("data-span", "10");
  await expect(graph).toHaveAttribute("data-y-max", "5");
  const rotation = () =>
    x
      .locator(".scale-rotor")
      .evaluate((node) =>
        Number(
          (node as HTMLElement).style.transform.match(/rotate\((.*?)deg\)/)![1],
        ),
      );
  expect(await rotation()).toBeGreaterThan(0);
  const clockwise = await rotation();
  await page.mouse.wheel(0, 100);
  await expect(x).toHaveAttribute("aria-valuenow", "4");
  expect(await rotation()).toBeLessThan(clockwise);
  await y.hover();
  await page.mouse.wheel(0, -50);
  await expect(y).toHaveAttribute("aria-valuenow", "5.5");
  await expect(graph).toHaveAttribute("data-y-min", "-5.5");
  await expect(graph).toHaveAttribute("data-y-max", "5.5");
  await expect(graph).toHaveAttribute("data-span", "8");
  await enterScale(page, "X", "1000000");
  await expect(graph).toHaveAttribute("data-span", "2000000");
  await enterScale(page, "X", "-20");
  await expect(x).toHaveAttribute("aria-valuenow", "0");
  await expect(graph).toHaveAttribute("data-span", "0");
  await x.hover();
  const stopped = await rotation();
  await page.mouse.wheel(0, 800);
  await expect(x).toHaveAttribute("aria-valuenow", "0");
  expect(await rotation()).toBe(stopped);
  await page.mouse.wheel(0, -25);
  await expect(x).toHaveAttribute("aria-valuenow", "0.25");
  await enterScale(page, "X", "8");
  await enterScale(page, "Y", "3");
  await y.focus();
  await page.keyboard.press("ArrowUp");
  await expect(y).toHaveAttribute("aria-valuenow", "4");
  await x.focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("X scale value", { exact: true })).toBeVisible();
  await page.getByLabel("X scale value", { exact: true }).press("Escape");
  await expect(x).toHaveAttribute("aria-valuenow", "8");
  expect((await audio()).starts).toBe(before.starts);
  expect((await audio()).frequency).toBeCloseTo(before.frequency, 2);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await expect(x).toHaveAttribute("aria-valuenow", "8");
  await expect(y).toHaveAttribute("aria-valuenow", "4");
  await expect(graph).toHaveAttribute("data-start", "-8");
  await expect(graph).toHaveAttribute("data-span", "16");
  await expect(graph).toHaveAttribute("data-y-min", "-4");
});

test("tan(x²/3) matches a deliberate symmetric view; the two dial designs fit light, dark and mobile frames", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("wf-one-equation", "tan(x^2 / 3)"),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await enterScale(page, "X", "8");
  await enterScale(page, "Y", "3");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".scale-knob-x .scale-arc")).toBeVisible();
  await expect(page.locator(".scale-knob-y .scale-dot")).toBeVisible();
  const frameFits = async (width: number, height: number) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(height);
  };
  await frameFits(1366, 768);
  await page.screenshot({
    path: ".local/axis-knobs-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator(".equation-page")).toHaveCSS(
    "background-color",
    "rgb(21, 21, 21)",
  );
  await page.screenshot({ path: ".local/axis-knobs-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await page
      .getByRole("button", { name: "Edit equation", exact: true })
      .click();
    const asText = page.getByRole("button", {
      name: "Edit as text",
      exact: true,
    });
    if (await asText.isVisible()) await asText.click();
    await page
      .getByLabel("Equation expression")
      .fill(referenceEquations[1].expression);
    await page.getByLabel("Equation expression").press("Escape");
    await frameFits(width, 720);
    await expect(
      page.getByRole("button", { name: "Edit X scale", exact: true }),
    ).toBeVisible();
    await enterScale(page, "Y", "0");
    await expect(page.locator(".graph-panel")).toHaveAttribute(
      "data-y-max",
      "0",
    );
    await enterScale(page, "Y", "5");
    const dial = page.getByRole("spinbutton", {
      name: "Y axis scale",
      exact: true,
    });
    const box = (await dial.boundingBox())!;
    await page.mouse.move(box.x + 3, box.y + 32);
    await page.mouse.down();
    await page.mouse.move(box.x + 13, box.y + 32);
    await page.mouse.up();
    await expect(dial).toHaveAttribute("aria-valuenow", "5.6");
    await enterScale(page, "Y", "5");
    await page.screenshot({
      path: `.local/axis-knobs-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".scale-knob-x .scale-rotor")).toHaveCSS(
    "transition-duration",
    "0s",
  );
});
