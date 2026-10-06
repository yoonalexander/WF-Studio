import { test, expect } from "@playwright/test";
import { sounds } from "../../src/sounds";

test("only the right arrows step through sounds; hovering the title reveals its dice", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.locator(".sound-picker [role=status]");
  const wheel = page.locator(".sound-wheel");
  const random = page.getByRole("button", {
    name: "Random sound",
    exact: true,
  });
  await page.mouse.move(0, 0);
  await expect(random.locator("svg")).toHaveCSS("opacity", "0");
  const box = (await wheel.boundingBox())!;
  // The previous/next labels on the left are no longer hidden arrow buttons.
  await page.mouse.click(box.x + 15, box.y + 9);
  await page.mouse.click(box.x + 15, box.y + 43);
  await expect(status).toHaveText("Sound: Electro lead");
  for (const name of ["Previous sound", "Next sound"]) {
    const arrow = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(arrow.width).toBe(28);
    expect(arrow.x).toBeGreaterThanOrEqual(box.x + box.width - 30);
  }
  await page.getByRole("button", { name: "Next sound", exact: true }).click();
  await expect(status).toHaveText("Sound: Deep electro");
  await page
    .getByRole("button", { name: "Previous sound", exact: true })
    .click();
  await expect(status).toHaveText("Sound: Electro lead");
  await random.hover();
  await expect(random.locator("svg")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: ".local/sound-dice-hover.png" });
  await page.mouse.move(0, 0);
  await expect(random.locator("svg")).toHaveCSS("opacity", "0");
  await page.keyboard.press("Tab");
  await random.focus();
  await expect(random.locator("svg")).toHaveCSS("opacity", "1");
});

test("random sound spins quickly then slows and lands; audio changes only once at landing without restarting its clock", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    localStorage.setItem("wf-one-equation", "0");
    const evidence = {
      context: undefined as AudioContext | undefined,
      root: undefined as OscillatorNode | undefined,
      starts: 0,
    };
    (
      window as unknown as { randomSoundAudio: typeof evidence }
    ).randomSoundAudio = evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        evidence.context = this;
      }
      createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node);
        evidence.root ??= node;
        node.start = (...args) => {
          if (node === evidence.root) evidence.starts++;
          start(...args);
        };
        return node;
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const a = (
        window as unknown as {
          randomSoundAudio: {
            context: AudioContext;
            root: OscillatorNode;
            starts: number;
          };
        }
      ).randomSoundAudio;
      return {
        frequency: a.root.frequency.value,
        time: a.context.currentTime,
        starts: a.starts,
      };
    });
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(261.625565, 0);
  const before = await state();
  const target = sounds[1 + Math.floor(0.5 * (sounds.length - 1))];
  await page.getByRole("button", { name: "Random sound", exact: true }).click();
  await expect(page.locator(".sound-wheel")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator(".sound-wheel-random svg")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next sound", exact: true }),
  ).toBeDisabled();
  const spin = page.locator(".sound-spin-strip");
  await expect(spin).toHaveCSS("animation-name", "sound-spin");
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    "Sound: Electro lead",
  );
  expect((await state()).frequency).toBeCloseTo(before.frequency, 0);
  const motion = await spin.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    const at = (time: number) => {
      animation.currentTime = time;
      return new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
    };
    const first = Math.abs(at(100) - at(300));
    const last = Math.abs(at(800) - at(1000));
    animation.currentTime = 300;
    animation.play();
    return { first, last };
  });
  expect(motion.first).toBeGreaterThan(motion.last * 3);
  await page.locator(".sound-wheel").hover();
  await page.mouse.wheel(0, 100);
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    `Sound: ${target.name}`,
  );
  await expect(spin).toHaveCount(0);
  await expect(page.locator(".sound-wheel-random svg")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Next sound", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(async () => (await state()).frequency)
    .toBeCloseTo(261.625565 * 2 ** (target.octave / 12), 0);
  const after = await state();
  expect(after.starts).toBe(1);
  expect(after.time).toBeGreaterThan(before.time);
  await expect(page.locator(".sound-wheel-strip > strong")).toHaveText(
    target.name,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("wf-equation-sound")),
  ).toBe(target.id);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await expect(page.locator(".sound-picker [role=status]")).toHaveText(
    `Sound: ${target.name}`,
  );
});

test("opening the library cancels a pending spin; reduced motion chooses immediately and random can reach either end of the catalog", async ({
  page,
}) => {
  await page.goto("/");
  const random = page.getByRole("button", {
    name: "Random sound",
    exact: true,
  });
  const status = page.locator(".sound-picker [role=status]");
  await random.click();
  await page
    .getByRole("button", { name: "Expand sound options", exact: true })
    .click();
  await page.getByRole("button", { name: "Pure sine", exact: true }).click();
  await page.waitForTimeout(1250);
  await expect(status).toHaveText("Sound: Pure sine");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await random.click();
  await expect(status).toHaveText("Sound: Minimoog bass");
  await expect(page.locator(".sound-spin-strip")).toHaveCount(0);
  // Maximum draw chooses the previous sound, wrapping at the beginning.
  await page
    .getByRole("button", { name: "Expand sound options", exact: true })
    .click();
  await page.getByRole("button", { name: "Electro lead", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.999999;
  });
  await random.click();
  await expect(status).toHaveText("Sound: 808 sub bass");
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await random.press("Enter");
  await expect(status).toHaveText("Sound: Electro lead");
  await expect(page.locator(".sound-wheel-strip")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test.describe("touch sound controls", () => {
  test.use({
    viewport: { width: 390, height: 720 },
    isMobile: true,
    hasTouch: true,
  });
  test("dice stays visible and a tap on the title randomizes while arrows remain separate", async ({
    page,
  }) => {
    await page.goto("/");
    const random = page.getByRole("button", {
      name: "Random sound",
      exact: true,
    });
    await expect(random.locator("svg")).toHaveCSS("opacity", "1");
    await random.tap();
    await expect(page.locator(".sound-wheel")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(random.locator("svg")).toHaveCount(0);
    await expect(page.locator(".sound-wheel")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(random.locator("svg")).toHaveCSS("opacity", "1");
    await expect(page.locator(".sound-picker [role=status]")).not.toHaveText(
      "Sound: Electro lead",
    );
    const selected = await page
      .locator(".sound-picker [role=status]")
      .innerText();
    await page.getByRole("button", { name: "Next sound", exact: true }).tap();
    await expect(page.locator(".sound-picker [role=status]")).not.toHaveText(
      selected,
    );
    await page.screenshot({
      path: ".local/sound-dice-mobile.png",
      animations: "disabled",
    });
  });
});
