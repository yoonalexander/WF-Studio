import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Crosshair, Maximize2 } from "lucide-react";
import { useStudio } from "../store";
import { audio } from "../audio";
import { drawGraph } from "../graph-render";
import type { Curve, View } from "../graph-render";
import type { MusicEvent } from "../music";
import { compositionRange, fitComposition } from "../simple";
import { axisView } from "../axis-scale";
import type { AxisScale } from "../axis-scale";
export function Graph({
  playing,
  onSeek,
  onError,
  simple = false,
  minimal = false,
  continuous = false,
  appearance,
  transport = audio,
  onSampled,
  axisScale,
}: {
  playing: boolean;
  onSeek: (beat: number) => void;
  onError: (s: string) => void;
  simple?: boolean;
  minimal?: boolean;
  continuous?: boolean;
  appearance?: "light" | "dark";
  transport?: Pick<typeof audio, "position" | "soundingNotes">;
  onSampled?: () => void;
  axisScale?: AxisScale;
}) {
  const project = useStudio((s) => s.project),
    selectedId = useStudio((s) => s.selectedId),
    change = useStudio((s) => s.change);
  const canvas = useRef<HTMLCanvasElement>(null),
    shell = useRef<HTMLDivElement>(null),
    worker = useRef<Worker | undefined>(undefined),
    curves = useRef<Curve[]>([]),
    events = useRef<MusicEvent[]>([]),
    request = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const workerWarm = useRef(false);
  const [storedView, setView] = useState<View>(() =>
      simple
        ? fitComposition(project, [], minimal)
        : { start: 0, span: 16, yCenter: 2, ySpan: 12 },
    ),
    [sampling, setSampling] = useState(false);
  const view = axisScale ? axisView(axisScale) : storedView;
  const state = useRef({
    project,
    selectedId,
    view,
    playing,
    simple,
    minimal,
    continuous,
    appearance,
    transport,
    onSampled,
    axisScale,
  });
  state.current = {
    project,
    selectedId,
    view,
    playing,
    simple,
    minimal,
    continuous,
    appearance,
    transport,
    onSampled,
    axisScale,
  };
  const factory = useRef<() => Worker>(() => {
    throw new Error("Worker is not initialized.");
  });
  useEffect(() => {
    const create = () => {
      workerWarm.current = false;
      const w = new Worker(new URL("../graph.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e) => {
        if (e.data.id !== request.current) return;
        clearTimeout(timer.current);
        curves.current = e.data.samples;
        events.current = e.data.events ?? [];
        workerWarm.current = true;
        if (state.current.simple && !state.current.axisScale)
          setView(
            fitComposition(
              state.current.project,
              curves.current,
              state.current.minimal,
            ),
          );
        setSampling(false);
        state.current.onSampled?.();
      };
      w.onerror = () => {
        clearTimeout(timer.current);
        w.terminate();
        worker.current = undefined;
        setSampling(false);
        onError("Graph sampling failed. Edit the equation to retry.");
      };
      return w;
    };
    factory.current = create;
    worker.current = create();
    return () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    };
  }, [onError]);
  const equations = JSON.stringify(project.tracks);
  const range = compositionRange(project, minimal);
  const sampleStart = simple && !axisScale ? range.start : view.start;
  const sampleSpan = simple && !axisScale ? range.span : view.span;
  const arrangement = JSON.stringify(project.sections);
  useEffect(() => {
    setSampling(true);
    const id = ++request.current;
    worker.current ??= factory.current();
    worker.current?.postMessage({
      id,
      tracks: project.tracks,
      beatsPerBar: project.beatsPerBar,
      start: sampleStart,
      span: sampleSpan,
      project,
      simple: simple && !minimal && !continuous,
      count: Math.min(1800, Math.max(600, canvas.current?.clientWidth ?? 900)),
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        worker.current?.terminate();
        worker.current = undefined;
        setSampling(false);
        onError(
          "This graph exceeded the sampling time limit. Simplify the expression to retry.",
        );
      },
      workerWarm.current ? 5000 : 15000,
    );
  }, [
    equations,
    sampleStart,
    sampleSpan,
    project.beatsPerBar,
    arrangement,
    simple,
    minimal,
    continuous,
    onError,
  ]);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (time: number) => {
      const c = canvas.current;
      if (c && time - last > (reduce ? 80 : 14)) {
        last = time;
        const rect = c.getBoundingClientRect(),
          ratio = Math.min(devicePixelRatio, 2),
          w = Math.round(rect.width * ratio),
          h = Math.round(rect.height * ratio);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          const s = state.current;
          const beat = s.minimal
            ? s.transport.position()
            : Math.max(0, s.transport.position());
          drawGraph(
            ctx,
            rect.width,
            rect.height,
            s.project,
            curves.current,
            s.view,
            beat,
            s.playing,
            s.selectedId,
            s.simple,
            events.current,
            s.transport.soundingNotes(),
            s.minimal,
            s.appearance,
            s.continuous,
          );
          if (
            s.playing &&
            !s.simple &&
            s.project.visuals.follow &&
            beat > s.view.start + s.view.span
          ) {
            setView((v) => ({
              ...v,
              start: Math.floor(beat / v.span) * v.span,
            }));
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  const drag = useRef<{
    x: number;
    y: number;
    view: View;
    moved: boolean;
  } | null>(null);
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      span: Math.min(256, Math.max(1, v.span * factor)),
      ySpan: Math.min(256, Math.max(2, v.ySpan * factor)),
    }));
  return (
    <div
      className={`graph-panel ${simple ? "simple-graph" : ""}`}
      ref={shell}
      data-start={view.start}
      data-span={view.span}
      data-y-min={view.yCenter - view.ySpan / 2}
      data-y-max={view.yCenter + view.ySpan / 2}
    >
      {!minimal && (
        <div className="panel-heading">
          {!simple && (
            <div>
              <span className="eyebrow">LIVE GRAPH</span>
              <h2>Every curve has a voice.</h2>
            </div>
          )}
          <div className="graph-actions">
            <span className={`sample-state ${simple ? "sr-only" : ""}`}>
              {sampling ? "Sampling…" : "x = beats"}
            </span>
            {!simple && (
              <>
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  onClick={() => zoom(1.5)}
                >
                  <Minus size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  onClick={() => zoom(1 / 1.5)}
                >
                  <Plus size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Reset graph view"
                  onClick={() =>
                    setView({
                      start: 0,
                      span: 16,
                      yCenter: 2,
                      ySpan: 12,
                    })
                  }
                >
                  <Crosshair size={16} />
                </button>
              </>
            )}
            <button
              className="icon-button"
              aria-label="Fullscreen graph"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void shell.current
                    ?.requestFullscreen()
                    .catch(() => onError("Fullscreen is unavailable."));
              }}
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}
      <canvas
        ref={canvas}
        aria-label={
          minimal
            ? "Equation graph. The moving point follows the sustained sound. Click to move along the equation."
            : simple
              ? "All equations, automatically fitted to the full loop. Click to move playback."
              : "Equation graph. Drag to pan; use zoom buttons. Click to move the playhead."
        }
        role="img"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            view: state.current.view,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || simple) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            d.moved = true;
            setView({
              ...d.view,
              start:
                d.view.start -
                (dx / (e.currentTarget.clientWidth - 74)) * d.view.span,
              yCenter:
                d.view.yCenter +
                (dy / (e.currentTarget.clientHeight - 70)) * d.view.ySpan,
            });
          }
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const rect = e.currentTarget.getBoundingClientRect();
            onSeek(
              Math.max(
                minimal ? view.start : 0,
                Math.min(
                  minimal ? view.start + view.span : project.lengthBeats,
                  view.start +
                    ((e.clientX - rect.left - 50) / (rect.width - 74)) *
                      view.span,
                ),
              ),
            );
          }
          drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
      />
      {!simple && (
        <div className="graph-footer">
          <div className="legend">
            {project.tracks
              .filter((t) => t.enabled)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => useStudio.getState().select(t.id)}
                  title={t.name}
                >
                  <i style={{ background: t.color }} />
                  {t.symbol}(x)
                </button>
              ))}
            {!project.tracks.length && (
              <span>Add a track to draw your first equation.</span>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={project.visuals.combined}
              onChange={(e) =>
                change((p) => {
                  p.visuals.combined = e.target.checked;
                })
              }
            />
            Σ combined curve
          </label>
        </div>
      )}
    </div>
  );
}
