import { test, expect } from "@playwright/test";

test("mobile playback reaches both selected X edges, including live expansion and a saved range", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem("wf-one-equation", "x / 4");
    // Only seed once, so a reload exercises the actual saved knob value.
    if (!localStorage.getItem("wf-axis-scales"))
      localStorage.setItem("wf-axis-scales", JSON.stringify({ x: 12, y: 8 }));
    const evidence = {
      starts: 0,
      dots: [] as number[],
      frequencies: [] as number[],
    };
    (window as unknown as { rangeEvidence: typeof evidence }).rangeEvidence =
      evidence;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() {
        const node = super.createOscillator();
        const start = node.start.bind(node);
        node.start = (...args) => {
          evidence.starts++;
          start(...args);
        };
        const target = node.frequency.setTargetAtTime.bind(node.frequency);
        node.frequency.setTargetAtTime = (...args) => {
          evidence.frequencies.push(args[0]);
          return target(...args);
        };
        return node;
      }
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      const graph = this.canvas.closest<HTMLElement>(".graph-panel");
      if (args[2] === 6 && graph) {
        const width = this.canvas.getBoundingClientRect().width;
        evidence.dots.push(
          Number(graph.dataset.start) +
            ((args[0] - 24) / (width - 48)) * Number(graph.dataset.span),
        );
      }
      return arc.apply(this, args);
    };
  });
  await page.goto("/");
  const canvas = page.locator("canvas");
  const seek = async (x: number, extent: number) => {
    const box = (await canvas.boundingBox())!;
    await canvas.click({
      position: {
        x: 24 + ((x + extent) / (2 * extent)) * (box.width - 48),
        y: box.height / 2,
      },
    });
  };
  const evidence = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            rangeEvidence: {
              starts: number;
              dots: number[];
              frequencies: number[];
            };
          }
        ).rangeEvidence,
    );
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await seek(11.6, 12);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x > 11.5))
    .toBe(true);
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x < -11.5))
    .toBe(true);

  await page.getByRole("button", { name: "Edit X scale", exact: true }).click();
  await page.getByLabel("X scale value", { exact: true }).fill("24");
  await page.getByLabel("X scale value", { exact: true }).press("Enter");
  await expect(page.locator(".graph-panel")).toHaveAttribute("data-span", "48");
  await seek(23.6, 24);
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x > 23.5))
    .toBe(true);
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x < -23.5))
    .toBe(true);
  const played = await evidence();
  expect(played.starts).toBe(1);
  expect(played.frequencies.some((f) => f > 360)).toBe(true);
  expect(played.frequencies.some((f) => f < 190)).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await expect(page.locator(".graph-panel")).toHaveAttribute(
    "data-start",
    "-24",
  );
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await seek(23.6, 24);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x > 23.5))
    .toBe(true);
  await expect
    .poll(async () => (await evidence()).dots.some((x) => x < -23.5))
    .toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});
