import { test, expect } from "@playwright/test";
import { newSimpleSong } from "../../src/simple";

async function contrast(
  locator: ReturnType<import("@playwright/test").Page["locator"]>,
) {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((n) => {
          const value = n / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(style.color),
      b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test("Simple Studio fits desktop frames with Tone on the same row", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(page.getByText("Simple Studio", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select Bass B" }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const tone = document
            .querySelector('[aria-label="Tone"]')!
            .closest("label")!
            .getBoundingClientRect();
          const sound = document
            .querySelector('[aria-label="Sound instrument"]')!
            .closest("label")!
            .getBoundingClientRect();
          return {
            scroll: document.documentElement.scrollHeight > innerHeight,
            overflow: document.documentElement.scrollWidth > innerWidth,
            row: Math.abs(tone.y - sound.y) < 1,
            accessible:
              tone.bottom < innerHeight - 40 &&
              document.querySelector(".simple-graph")!.getBoundingClientRect()
                .height >= 140,
          };
        }),
      )
      .toEqual({ scroll: false, overflow: false, row: true, accessible: true });
  }
});

test("An existing project survives the IndexedDB upgrade that adds Trash", async ({
  page,
}) => {
  const legacy = newSimpleSong();
  legacy.name = "Existing saved song";
  legacy.tracks[0].expression = "6.25";
  await page.route("**/storage-seed", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Storage fixture</title>",
    }),
  );
  await page.goto("/storage-seed");
  await page.evaluate(async (project) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("wave-function-studio", 10);
      open.onupgradeneeded = () => {
        const table = open.result.createObjectStore("projects", {
          keyPath: "id",
        });
        table.createIndex("updatedAt", "updatedAt");
        table.createIndex("name", "name");
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction("projects", "readwrite");
        transaction.objectStore("projects").put(project);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    localStorage.setItem("wf-active", project.id);
  }, legacy);
  await page.goto("/studio");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Existing saved song",
  );
  await expect(page.getByLabel("Equation expression")).toHaveText("6.25");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Delete project Existing saved song",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Trash \(/ }).click();
  await expect(page.getByText("Trash is empty.")).toBeVisible();
});

test("Studio themes match Home Page and keep live audio running", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = OscillatorNode.prototype.start;
    (window as unknown as { starts: number }).starts = 0;
    OscillatorNode.prototype.start = function (...args) {
      (window as unknown as { starts: number }).starts++;
      return start.apply(this, args);
    };
  });
  await page.goto("/studio");
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "light");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const starts = await page.evaluate(
    () => (window as unknown as { starts: number }).starts,
  );
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((node) =>
          Array.from(
            (node as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(2, 2, 1, 1).data,
          ),
        ),
    )
    .toEqual([21, 21, 21, 255]);
  expect(
    await page.evaluate(() => (window as unknown as { starts: number }).starts),
  ).toBe(starts);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Detailed view", exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  const actions = await page.locator(".top-actions > button").allTextContents();
  expect(actions.at(-1)?.trim()).toBe("Simple view");
  await expect(page.locator(".view-switch svg")).toBeVisible();
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((node) =>
          Array.from(
            (node as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(2, 2, 1, 1).data,
          ),
        ),
    )
    .toEqual([255, 255, 255, 255]);
  await page.getByRole("button", { name: "Home Page", exact: true }).click();
  await expect(page.locator(".equation-page")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("link", { name: "Song studio" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
});

test("New project and Export buttons have readable contrast in both themes", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  for (const theme of ["Light", "Dark"]) {
    await page
      .getByRole("button", { name: `${theme} mode`, exact: true })
      .click();
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    expect(
      await contrast(
        page.getByRole("button", { name: "New project", exact: true }),
      ),
    ).toBeGreaterThan(7);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    expect(
      await contrast(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Export", exact: true }),
      ),
    ).toBeGreaterThan(7);
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
});

test("Projects can be deleted, restored, and kept deleted after autosave and reload", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  await expect(page.locator(".simple-sound")).toHaveCount(1);
  await page.getByLabel("Project name").fill("Keep this song");
  await page.getByLabel("Equation expression").fill("6.25");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "New song", exact: true }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("My song");
  await page.getByLabel("Project name").fill("Remove duplicate");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project Keep this song", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Delete project Keep this song",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Trash \(/ }).click();
  await page
    .getByRole("button", {
      name: "Restore project Keep this song",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Restore project Keep this song",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Saved projects \(/ }).click();
  await page
    .getByRole("button", {
      name: "Delete project Remove duplicate",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Project name")).toHaveValue("My song");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Delete project Remove duplicate",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .locator(".project-open")
    .filter({ hasText: "Keep this song" })
    .click();
  await expect(page.getByLabel("Equation expression")).toHaveText("6.25");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: /Trash \(/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Restore project Remove duplicate",
      exact: true,
    }),
  ).toBeVisible();
});
