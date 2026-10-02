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
    const breaks = new Uint8Array(count);
    let branch = "";
    for (let i = 0; i < count; i++) {
      const point = engine.sample(t.id, start + (i / (count - 1)) * span);
      values[i] = point.value;
      breaks[i] = Number(i > 0 && point.branch !== branch);
      branch = point.branch;
    }
    return { id: t.id, values, breaks };
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
    { transfer: samples.flatMap((s) => [s.values.buffer, s.breaks.buffer]) },
  );
};
