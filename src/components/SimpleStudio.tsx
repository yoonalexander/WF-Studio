import { useMemo } from "react";
import { Play, Pause, RotateCcw, ArrowUpRight } from "lucide-react";
import katex from "katex";
import { useStudio } from "../store";
import type { MathEngine } from "../math";
import { Graph } from "./Graph";
import { EquationEditor } from "./EquationEditor";

export function SimpleStudio({
  engine,
  playing,
  ready,
  status,
  onPlay,
  onSeek,
  onError,
  onDetailed,
  onExamples,
  onHelp,
}: {
  engine: MathEngine;
  playing: boolean;
  ready: boolean;
  status: string;
  onPlay: () => void;
  onSeek: (beat: number) => void;
  onError: (message: string) => void;
  onDetailed: () => void;
  onExamples: () => void;
  onHelp: () => void;
}) {
  const {
    project,
    selectedId,
    track: update,
    select,
    change,
    add,
  } = useStudio();
  const track = project.tracks.find((t) => t.id === selectedId);
  const notation = useMemo(() => {
    if (!track || !engine.tex[track.id] || engine.errors[track.id]) return "";
    try {
      return katex.renderToString(`y = ${engine.tex[track.id]}`, {
        throwOnError: false,
        trust: false,
        output: "html",
        displayMode: true,
      });
    } catch {
      return "";
    }
  }, [track, engine]);
  return (
    <>
      <header className="simple-header">
        <span className="simple-wordmark">Wave Function</span>
        <button className="simple-detail-switch" onClick={onDetailed}>
          Detailed studio <ArrowUpRight size={15} />
        </button>
      </header>
      <main className="simple-studio">
        <Graph simple playing={playing} onSeek={onSeek} onError={onError} />
        <section className="simple-equation" aria-label="Equation">
          {track ? (
            <>
              <div
                className="simple-notation"
                aria-label="Rendered equation"
                dangerouslySetInnerHTML={{ __html: notation }}
              />
              <div
                className={`simple-input ${engine.errors[track.id] ? "invalid" : ""}`}
              >
                <span className="equation-prefix" aria-hidden="true">
                  y =
                </span>
                <EquationEditor
                  key={track.id}
                  simple
                  value={track.expression}
                  symbols={project.tracks.map((t) => t.symbol)}
                  onChange={(expression) =>
                    update(track.id, { expression }, `${track.id}-expression`)
                  }
                />
              </div>
              {engine.errors[track.id] && (
                <p className="simple-error" role="alert">
                  {engine.errors[track.id]}
                </p>
              )}
            </>
          ) : (
            <button className="simple-add" onClick={() => add("synth")}>
              + Add your first equation
            </button>
          )}
          <div className="simple-controls">
            <div className="simple-playback">
              <button
                className="simple-play"
                aria-label={playing ? "Pause" : "Play"}
                disabled={!ready}
                onClick={onPlay}
              >
                {playing ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                {playing ? "Pause" : "Play"}
              </button>
              <button
                aria-label="Restart"
                title="Restart"
                onClick={() =>
                  onSeek(project.loop.enabled ? project.loop.startBeat : 0)
                }
              >
                <RotateCcw size={16} />
              </button>
              <label className="simple-tempo">
                <input
                  aria-label="BPM"
                  type="number"
                  min={30}
                  max={300}
                  value={project.bpm}
                  onChange={(e) =>
                    change((p) => {
                      p.bpm = Math.max(
                        30,
                        Math.min(300, Number(e.target.value) || 30),
                      );
                    }, "bpm")
                  }
                />{" "}
                BPM
              </label>
            </div>
            {project.tracks.length > 1 && (
              <select
                className="simple-track-select"
                aria-label="Equation track"
                value={selectedId}
                onChange={(e) => select(e.target.value)}
              >
                {project.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.symbol}(x)
                  </option>
                ))}
              </select>
            )}
            <div className="simple-links">
              <button onClick={onExamples}>Examples</button>
              <button onClick={onHelp}>Help</button>
            </div>
          </div>
          <p className="simple-hint">
            Use x for time. Try sin(x), x mod 4, or piecewise(x &lt; 2, x, 0).
          </p>
          <span className="sr-only" role="status">
            {status}
          </span>
        </section>
      </main>
    </>
  );
}
