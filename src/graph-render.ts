import type { Project } from "./model";
export interface Curve {
  id: string;
  values: Float32Array;
}
export interface View {
  start: number;
  span: number;
  yCenter: number;
  ySpan: number;
}
export const graphThemes = {
  dark: { bg: "#171c28", grid: "#293141", axis: "#68788b", text: "#9daac0" },
  light: { bg: "#fcfcfa", grid: "#e3e6e8", axis: "#9babb3", text: "#667686" },
  neon: { bg: "#1b1230", grid: "#32254b", axis: "#695880", text: "#b3a3cf" },
  blueprint: {
    bg: "#172e48",
    grid: "#27415e",
    axis: "#648cb2",
    text: "#afc8df",
  },
  mono: { bg: "#f6f6f4", grid: "#e1e1dc", axis: "#999992", text: "#666660" },
};
export function drawGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: Project,
  curves: Curve[],
  view: View,
  beat: number,
  playing: boolean,
  selectedId = "",
) {
  const theme = graphThemes[project.visuals.theme],
    pad = { left: 50, right: 24, top: 30, bottom: 40 },
    w = width - pad.left - pad.right,
    h = height - pad.top - pad.bottom;
  const px = (x: number) => pad.left + ((x - view.start) / view.span) * w,
    py = (y: number) => pad.top + h / 2 - ((y - view.yCenter) / view.ySpan) * h;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.lineWidth = 1;
  const xStep = 2 ** Math.ceil(Math.log2(view.span / 12)),
    yStep = 2 ** Math.ceil(Math.log2(view.ySpan / 8));
  for (
    let x = Math.ceil(view.start / xStep) * xStep;
    x <= view.start + view.span;
    x += xStep
  ) {
    const pixel = px(x);
    if (project.visuals.grid) {
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(pixel, pad.top);
      ctx.lineTo(pixel, height - pad.bottom);
      ctx.stroke();
    }
    ctx.fillStyle = theme.text;
    ctx.fillText(String(Math.round(x * 100) / 100), pixel, height - 17);
  }
  for (
    let y = Math.ceil((view.yCenter - view.ySpan / 2) / yStep) * yStep;
    y <= view.yCenter + view.ySpan / 2;
    y += yStep
  ) {
    const pixel = py(y);
    if (project.visuals.grid) {
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(pad.left, pixel);
      ctx.lineTo(width - pad.right, pixel);
      ctx.stroke();
    }
    ctx.fillStyle = theme.text;
    ctx.fillText(String(Math.round(y * 100) / 100), 27, pixel + 4);
  }
  ctx.strokeStyle = theme.axis;
  ctx.beginPath();
  if (py(0) > pad.top && py(0) < height - pad.bottom) {
    ctx.moveTo(pad.left, py(0));
    ctx.lineTo(width - pad.right, py(0));
  }
  if (px(0) >= pad.left && px(0) < width - pad.right) {
    ctx.moveTo(px(0), pad.top);
    ctx.lineTo(px(0), height - pad.bottom);
  }
  ctx.stroke();
  ctx.fillStyle = theme.text;
  ctx.textAlign = "right";
  ctx.fillText("x / beats", width - pad.right, 16);
  ctx.textAlign = "left";
  ctx.fillText("f(x)", pad.left, 16);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top, w, h);
  ctx.clip();
  let drawn = curves;
  if (project.visuals.combined && curves.length) {
    const values = new Float32Array(curves[0].values.length);
    for (let i = 0; i < values.length; i++) {
      values[i] = curves.reduce((sum, c) => {
        const t = project.tracks.find((t) => t.id === c.id);
        return sum + (t?.enabled && !t.muted ? c.values[i] : 0);
      }, 0);
    }
    drawn = [{ id: "sum", values }];
  }
  for (const curve of drawn) {
    const track = project.tracks.find((t) => t.id === curve.id);
    if (track && !track.enabled) continue;
    const section = project.sections.find(
      (s) => beat >= s.startBeat && beat < s.endBeat,
    );
    const active =
      !track ||
      (!track.muted && (!section || section.activeTrackIds.includes(track.id)));
    const rawColor = track?.color ?? "#f0e7ff";
    const color =
      project.visuals.theme === "mono"
        ? "#282832"
        : project.visuals.theme === "light"
          ? `#${[1, 3, 5]
              .map((i) =>
                Math.round(parseInt(rawColor.slice(i, i + 2), 16) * 0.58)
                  .toString(16)
                  .padStart(2, "0"),
              )
              .join("")}`
          : rawColor;
    ctx.strokeStyle = color;
    ctx.lineWidth =
      project.visuals.lineWidth + (track?.id === selectedId ? 0.4 : 0);
    ctx.globalAlpha = active ? (playing ? 0.4 : 0.85) : 0.18;
    if (project.visuals.glow || project.visuals.theme === "neon") {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    let pen = false,
      last = 0;
    for (let i = 0; i < curve.values.length; i++) {
      const y = curve.values[i],
        pixel = py(y),
        x = pad.left + (i / (curve.values.length - 1)) * w;
      if (
        !Number.isFinite(y) ||
        pixel < pad.top - 3 * h ||
        pixel > pad.top + 4 * h
      ) {
        pen = false;
        continue;
      }
      if (!pen || Math.abs(pixel - last) > h * 0.6) ctx.moveTo(x, pixel);
      else ctx.lineTo(x, pixel);
      pen = true;
      last = pixel;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (playing && active && beat > view.start) {
      ctx.save();
      const curvePath = new Path2D();
      let connected = false,
        prev = 0;
      for (let i = 0; i < curve.values.length; i++) {
        const y = curve.values[i],
          pixel = py(y),
          x = pad.left + (i / (curve.values.length - 1)) * w;
        if (
          !Number.isFinite(y) ||
          pixel < pad.top - 3 * h ||
          pixel > pad.top + 4 * h
        ) {
          connected = false;
          continue;
        }
        if (!connected || Math.abs(pixel - prev) > h * 0.6)
          curvePath.moveTo(x, pixel);
        else curvePath.lineTo(x, pixel);
        connected = true;
        prev = pixel;
      }
      ctx.beginPath();
      ctx.rect(pad.left, pad.top, Math.min(w, px(beat) - pad.left), h);
      ctx.clip();
      ctx.globalAlpha = 0.95;
      ctx.stroke(curvePath);
      ctx.restore();
    }
    if (playing && beat >= view.start && beat <= view.start + view.span) {
      const index = Math.round(
          ((beat - view.start) / view.span) * (curve.values.length - 1),
        ),
        y = curve.values[index];
      if (Number.isFinite(y)) {
        ctx.globalAlpha = active ? 1 : 0.2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px(beat), py(y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  if (beat >= view.start && beat <= view.start + view.span) {
    ctx.strokeStyle = theme.text;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(px(beat), pad.top);
    ctx.lineTo(px(beat), height - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
