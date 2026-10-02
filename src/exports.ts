import type { Project } from "./model";
import { collectEvents } from "./music";
import { audio } from "./audio";
import { createMathEngine } from "./math";
import { drawGraph } from "./graph-render";
import type { Curve } from "./graph-render";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const filename = (name: string) =>
  name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "composition";
export function encodeWav(buffer: AudioBuffer) {
  const bytes = new ArrayBuffer(44 + buffer.length * 4),
    v = new DataView(bytes);
  let at = 0;
  const text = (s: string) => {
    for (const c of s) v.setUint8(at++, c.charCodeAt(0));
  };
  const u32 = (n: number) => {
    v.setUint32(at, n, true);
    at += 4;
  };
  const u16 = (n: number) => {
    v.setUint16(at, n, true);
    at += 2;
  };
  text("RIFF");
  u32(bytes.byteLength - 8);
  text("WAVEfmt ");
  u32(16);
  u16(1);
  u16(2);
  u32(buffer.sampleRate);
  u32(buffer.sampleRate * 4);
  u16(4);
  u16(16);
  text("data");
  u32(buffer.length * 4);
  const left = buffer.getChannelData(0),
    right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
  for (let i = 0; i < buffer.length; i++)
    for (const x of [left[i], right[i]]) {
      v.setInt16(
        at,
        Math.round(Math.max(-1, Math.min(1, x)) * (x < 0 ? 32768 : 32767)),
        true,
      );
      at += 2;
    }
  return new Blob([bytes], { type: "audio/wav" });
}
const vlq = (n: number) => {
  const out = [n & 127];
  while ((n >>= 7)) out.unshift((n & 127) | 128);
  return out;
};
const big = (n: number, length: number) =>
  Array.from({ length }, (_, i) => (n >> ((length - i - 1) * 8)) & 255);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const chunk = (name: string, data: number[]) => [
  ...ascii(name),
  ...big(data.length, 4),
  ...data,
];
export function encodeMidi(project: Project, start: number, end: number) {
  const events = collectEvents(project, start, end),
    tempo = Math.round(60000000 / project.bpm),
    ppq = 480;
  const chunks = [
    chunk("MTrk", [
      0,
      255,
      81,
      3,
      ...big(tempo, 3),
      0,
      255,
      88,
      4,
      project.beatsPerBar,
      2,
      24,
      8,
      0,
      255,
      47,
      0,
    ]),
  ];
  project.tracks.forEach((track, index) => {
    const drum = ["kick", "snare", "hat", "open-hat", "clap"].includes(
        track.instrument,
      ),
      channel = drum ? 9 : index % 15 >= 9 ? (index % 15) + 1 : index % 15;
    const drumNotes: Record<string, number> = {
      kick: 36,
      snare: 38,
      hat: 42,
      "open-hat": 46,
      clap: 39,
    };
    const data: { tick: number; bytes: number[] }[] = [];
    for (const e of events.filter((e) => e.trackId === track.id)) {
      const note = drum ? drumNotes[track.instrument] : e.note;
      data.push(
        {
          tick: Math.round((e.beat - start) * ppq),
          bytes: [
            144 + channel,
            note,
            Math.max(1, Math.round(e.velocity * track.volume * 127)),
          ],
        },
        {
          tick: Math.round((e.beat - start + e.duration) * ppq),
          bytes: [128 + channel, note, 0],
        },
      );
    }
    data.sort(
      (a, b) => a.tick - b.tick || (a.bytes[0] & 0xf0) - (b.bytes[0] & 0xf0),
    );
    const name = Array.from(new TextEncoder().encode(track.name)),
      bytes = [
        0,
        255,
        3,
        ...vlq(name.length),
        ...name,
        0,
        192 + channel,
        track.instrument === "bass" ? 38 : 80,
      ];
    let prev = 0;
    for (const e of data) {
      bytes.push(...vlq(e.tick - prev), ...e.bytes);
      prev = e.tick;
    }
    bytes.push(0, 255, 47, 0);
    chunks.push(chunk("MTrk", bytes));
  });
  return new Blob(
    [
      new Uint8Array([
        ...ascii("MThd"),
        ...big(6, 4),
        ...big(1, 2),
        ...big(chunks.length, 2),
        ...big(ppq, 2),
        ...chunks.flat(),
      ]),
    ],
    { type: "audio/midi" },
  );
}
export async function exportVideo(
  project: Project,
  start: number,
  end: number,
  aspect: "wide" | "portrait" | "square",
  signal: AbortSignal,
  progress: (v: number) => void,
) {
  if (
    !("MediaRecorder" in window) ||
    !HTMLCanvasElement.prototype.captureStream
  )
    throw new Error(
      "Video export is unavailable in this browser. Use Chrome or Edge.",
    );
  const type = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error("No supported video encoder.");
  const buffer = await audio.render(project, start, end);
  if (signal.aborted) throw new Error("Export canceled.");
  const canvas = document.createElement("canvas");
  canvas.width =
    aspect === "portrait" ? 1080 : aspect === "square" ? 1080 : 1920;
  canvas.height = aspect === "wide" ? 1080 : aspect === "square" ? 1080 : 1920;
  const ctx = canvas.getContext("2d")!,
    context = new AudioContext();
  await context.resume();
  const dest = context.createMediaStreamDestination(),
    source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);
  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const recorder = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  const engine = createMathEngine(project.tracks, project.beatsPerBar),
    count = 1000,
    view = { start, span: Math.min(16, end - start), yCenter: 2, ySpan: 12 };
  let frame = 0,
    lastView = NaN;
  let curves: Curve[] = [];
  const origin = context.currentTime + 0.1;
  function paint() {
    const elapsed = Math.max(0, context.currentTime - origin),
      beat = Math.min(end, start + (elapsed * project.bpm) / 60);
    view.start = start + Math.floor((beat - start) / view.span) * view.span;
    if (view.start !== lastView) {
      lastView = view.start;
      curves = project.tracks.map((t) => {
        const values = new Float32Array(count),
          breaks = new Uint8Array(count);
        let branch = "";
        for (let i = 0; i < count; i++) {
          const point = engine.sample(
            t.id,
            view.start + (i / (count - 1)) * view.span,
          );
          values[i] = point.value;
          breaks[i] = Number(i > 0 && point.branch !== branch);
          branch = point.branch;
        }
        return { id: t.id, values, breaks };
      });
    }
    drawGraph(
      ctx,
      canvas.width,
      canvas.height,
      project,
      curves,
      view,
      beat,
      true,
    );
    ctx.fillStyle =
      project.visuals.theme === "light" || project.visuals.theme === "mono"
        ? "#222831"
        : "#f0f3f6";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(project.name, 60, 70);
    ctx.font = "20px monospace";
    ctx.fillText(
      project.tracks
        .filter((t) => t.enabled && !t.muted)
        .map((t) => `${t.symbol}(x)`)
        .join(" + "),
      60,
      105,
    );
    progress(Math.min(100, (elapsed / buffer.duration) * 100));
    frame = requestAnimationFrame(paint);
  }
  try {
    const result = await new Promise<Blob>((resolve, reject) => {
      const abort = () => {
        if (recorder.state !== "inactive") recorder.stop();
        reject(new Error("Export canceled."));
      };
      signal.addEventListener("abort", abort, { once: true });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("Video recording failed."));
      };
      recorder.onstop = () => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted) resolve(new Blob(chunks, { type }));
      };
      source.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
      paint();
      recorder.start(500);
      source.start(origin);
    });
    return {
      blob: result,
      extension: type.startsWith("video/mp4") ? "mp4" : "webm",
    };
  } finally {
    cancelAnimationFrame(frame);
    try {
      source.stop();
    } catch {
      /* Ended. */
    }
    stream.getTracks().forEach((t) => t.stop());
    await context.close();
  }
}
