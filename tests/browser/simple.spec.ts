import { test, expect } from "@playwright/test";

test("simple view edits the same project, keeps playback running across views and remembers the view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
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
      if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) black++;
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
  await page.getByRole("button", { name: "Detailed studio" }).click();
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
  await page.getByRole("button", { name: "Detailed studio" }).click();
  await page.reload();
  await expect(page.locator(".tracks-panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("simple view fits small screens, selects equations and handles an empty project", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Saved on this device")).toBeAttached();
  await page
    .getByLabel("Equation track")
    .selectOption({ label: "Bass · B(x)" });
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
  await page.getByRole("button", { name: "Detailed studio" }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await page.getByRole("button", { name: "Add your first equation" }).click();
  await expect(page.getByLabel("Equation expression")).toContainText(
    "sequence(",
  );
});
