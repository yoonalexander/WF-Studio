import { test, expect } from "@playwright/test";
import {
  referenceEquations,
  randomReferenceEquation,
} from "../../src/reference-equations";

test("all 25 screenshot equations render on the main page with playable Random versions", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  for (const reference of referenceEquations) {
    await page.evaluate(
      (expression) => localStorage.setItem("wf-one-equation", expression),
      randomReferenceEquation(
        reference,
        (options) => options[options.length - 1],
      ),
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByLabel("Rendered equation"),
      reference.name,
    ).not.toBeEmpty();
    await expect(page.getByRole("alert"), reference.name).toHaveCount(0);
    const frame = await page.locator(".graph-panel").evaluate((node) => ({
      min: Number((node as HTMLElement).dataset.yMin),
      max: Number((node as HTMLElement).dataset.yMax),
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    }));
    expect(frame.max - frame.min, reference.name).toBeGreaterThan(0);
    expect(frame.width, reference.name).toBeLessThanOrEqual(
      frame.viewportWidth,
    );
    expect(frame.height, reference.name).toBeLessThanOrEqual(
      frame.viewportHeight,
    );
    if (reference.id === "21") expect(frame.max - frame.min).toBeLessThan(12);
  }
});

test("the negative-only original is visible, seekable and remembered; long cases fit mobile", async ({
  page,
}) => {
  await page.addInitScript(
    (expression) => localStorage.setItem("wf-one-equation", expression),
    referenceEquations[0].expression,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".graph-panel")).toHaveAttribute(
    "data-start",
    "-8",
  );
  await expect(page.locator(".graph-panel")).toHaveAttribute("data-span", "16");
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  await canvas.click({
    position: {
      x: 50 + ((-7.4 + 8) / 16) * (box.width - 74),
      y: box.height / 2,
    },
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  for (const index of [2, 3, 7, 10, 12, 24]) {
    // Edit through the actual text field to preserve this page's storage fixture.
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
    await page
      .getByLabel("Equation expression")
      .fill(referenceEquations[index].expression);
    await page.getByLabel("Equation expression").press("Escape");
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(720);
  }
});
