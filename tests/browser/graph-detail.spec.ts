import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 393, height: 852 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

test("a steep continuous line reaches the mobile frame rather than vanishing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "1e6 * (x - 1)");
    localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 4, y: 5 }));
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        const box = canvas.getBoundingClientRect(),
          ratio = canvas.width / box.width;
        const x = 24 + ((1.000003 + 4) / 8) * (box.width - 48);
        const y = 30 + ((5 - 3) / 10) * (box.height - 60);
        const data = canvas
          .getContext("2d")!
          .getImageData(
            Math.floor((x - 2) * ratio),
            Math.floor((y - 2) * ratio),
            Math.ceil(4 * ratio),
            Math.ceil(4 * ratio),
          ).data;
        return Array.from(data).some(
          (channel, i) => i % 4 === 0 && channel < 120,
        );
      }),
    )
    .toBe(true);
});

test("mobile sine-ratio tails remain visible at the reported scales, with the origin centered", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "1.2 * sin(x / 2) / sin(1.2 * x)");
    localStorage.setItem(
      "wf-axis-scales",
      JSON.stringify({ x: 56.64, y: 26.08 }),
    );
    const moves = CanvasRenderingContext2D.prototype.moveTo;
    const lines = CanvasRenderingContext2D.prototype.lineTo;
    const begin = CanvasRenderingContext2D.prototype.beginPath;
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    const paths = new WeakMap<CanvasRenderingContext2D, number[][]>();
    CanvasRenderingContext2D.prototype.beginPath = function () {
      paths.set(this, []);
      begin.call(this);
    };
    CanvasRenderingContext2D.prototype.moveTo = function (x, y) {
      paths.get(this)?.push([x, y]);
      moves.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      paths.get(this)?.push([x, y]);
      lines.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
      if (this.lineWidth === 1)
        (window as unknown as { axes: number[][] }).axes =
          paths.get(this) ?? [];
      Reflect.apply(stroke, this, path ? [path] : []);
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  const geometry = await page.locator("canvas").evaluate((canvas) => {
    const box = canvas.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      left: box.left,
      axes: (window as unknown as { axes: number[][] }).axes,
    };
  });
  expect(geometry.axes[0][1]).toBeCloseTo(geometry.height / 2, 1);
  expect(geometry.axes[2][0] + geometry.left).toBeCloseTo(393 / 2, 1);
  const f = (x: number) => (1.2 * Math.sin(x / 2)) / Math.sin(1.2 * x);
  for (const k of [1, 5, 17, -5]) {
    const pole = (k * Math.PI) / 1.2;
    let lo = 1e-7,
      hi = 0.2;
    for (let i = 0; i < 55; i++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(f(pole + mid)) > 20) lo = mid;
      else hi = mid;
    }
    const x = pole + (lo + hi) / 2,
      y = f(x);
    // Check actual canvas pixels before playing: a moving dot cannot mask
    // an absent curve. These are tails far from either axis.
    await expect
      .poll(
        () =>
          page.locator("canvas").evaluate(
            (node, point) => {
              const canvas = node as HTMLCanvasElement;
              const box = canvas.getBoundingClientRect();
              const ratio = canvas.width / box.width;
              const px = 24 + ((point.x + 56.64) / 113.28) * (box.width - 48);
              const py = 30 + ((26.08 - point.y) / 52.16) * (box.height - 60);
              const data = canvas
                .getContext("2d")!
                .getImageData(
                  Math.floor((px - 2) * ratio),
                  Math.floor((py - 2) * ratio),
                  Math.ceil(4 * ratio),
                  Math.ceil(4 * ratio),
                ).data;
              let dark = false;
              for (let i = 0; i < data.length; i += 4)
                if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120)
                  dark = true;
              return dark;
            },
            { x, y },
          ),
        { message: `visible tail at x=${x}, y=${y}` },
      )
      .toBe(true);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(393);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(852);
  await page.screenshot({
    path: ".local/mobile-curve-fixed.png",
    fullPage: true,
  });
  await page
    .locator("canvas")
    .screenshot({ path: ".local/mobile-curve-detail.png" });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});
