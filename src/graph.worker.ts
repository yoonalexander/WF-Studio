import { createMathEngine } from "./math";
import type { Track } from "./model";
self.onmessage = (
  e: MessageEvent<{
    id: number;
    tracks: Track[];
    beatsPerBar: number;
    start: number;
    span: number;
    count: number;
  }>,
) => {
  const { id, tracks, beatsPerBar, start, span, count } = e.data;
  const engine = createMathEngine(tracks, beatsPerBar);
  const samples = tracks.map((t) => {
    const values = new Float32Array(count);
    for (let i = 0; i < count; i++)
      values[i] = engine.value(t.id, start + (i / (count - 1)) * span);
    return { id: t.id, values };
  });
  self.postMessage(
    { id, samples, errors: engine.errors },
    { transfer: samples.map((s) => s.values.buffer) },
  );
};
