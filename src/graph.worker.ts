import { createMathEngine } from "./math";
import type { Track, Project } from "./model";
import { collectEvents } from "./music";
self.onmessage = (
  e: MessageEvent<{
    id: number;
    tracks: Track[];
    beatsPerBar: number;
    start: number;
    span: number;
    count: number;
    project?: Project;
    simple?: boolean;
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
  let events: ReturnType<typeof collectEvents> = [];
  if (e.data.simple && e.data.project) {
    try {
      events = collectEvents(e.data.project, start, start + span, engine);
    } catch {
      /* Dense equations still render; the scheduler remains authoritative. */
    }
  }
  self.postMessage(
    { id, samples, events, errors: engine.errors },
    { transfer: samples.map((s) => s.values.buffer) },
  );
};
