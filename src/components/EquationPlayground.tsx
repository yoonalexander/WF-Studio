import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Pause, ArrowUpRight } from "lucide-react";
import katex from "katex";
import { useStudio } from "../store";
import { newSimpleSong } from "../simple";
import { createMathEngine } from "../math";
import { continuousAudio } from "../continuous-audio";
import { Graph } from "./Graph";
import { EquationEditor } from "./EquationEditor";

const draftKey = "wf-one-equation";
export function EquationPlayground({ onStudio }: { onStudio: () => void }) {
  const { project, load, track: update } = useStudio();
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false);
  const [graphReady, setGraphReady] = useState(false);
  const [editing, setEditing] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const single = newSimpleSong();
    single.name = "One equation";
    single.lengthBeats = single.loop.endBeat = 4;
    Object.assign(single.tracks[0], {
      symbol: "f",
      color: "#111111",
      waveform: "sine",
      scale: "chromatic",
    });
    try {
      const expression = localStorage.getItem(draftKey);
      if (expression !== null && expression.length <= 1024)
        single.tracks[0].expression = expression;
    } catch {
      /* Editing still works without browser storage. */
    }
    load(single);
    setReady(true);
    return () => continuousAudio.pause();
  }, [load]);
  const engine = useMemo(
    () => createMathEngine(project.tracks, project.beatsPerBar),
    [project.tracks, project.beatsPerBar],
  );
  const track = project.tracks[0];
  const error = ready && track ? engine.errors[track.id] : undefined;
  useEffect(() => {
    if (ready) continuousAudio.update(project);
  }, [project, ready]);
  const changeExpression = (expression: string) => {
    if (!track) return;
    setGraphReady(false);
    setMessage("");
    update(track.id, { expression });
    try {
      localStorage.setItem(draftKey, expression);
    } catch {
      /* Storage is optional. */
    }
  };
  const toggle = useCallback(async () => {
    if (continuousAudio.playing) {
      continuousAudio.pause();
      setPlaying(false);
      return;
    }
    if (!ready || !graphReady || error) return;
    try {
      await continuousAudio.play(useStudio.getState().project);
      setPlaying(continuousAudio.playing);
    } catch {
      setMessage("Sound could not start. Press Play to try again.");
    }
  }, [ready, graphReady, error]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button,a,input,.cm-editor")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggle();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [toggle]);
  const notation =
    ready && track && !error && engine.tex[track.id]
      ? katex.renderToString(`y = ${engine.tex[track.id]}`, {
          throwOnError: false,
          trust: false,
          displayMode: true,
          output: "html",
        })
      : "";
  const notify = useCallback((s: string) => setMessage(s), []);
  const sampled = useCallback(() => setGraphReady(true), []);
  return (
    <div className="app simple-app equation-page" data-theme="simple">
      <header className="equation-header">
        <span>Wave Function</span>
        <a
          href="/studio"
          onClick={(e) => {
            e.preventDefault();
            onStudio();
          }}
        >
          Song studio <ArrowUpRight size={14} />
        </a>
      </header>
      <main className="equation-playground">
        {ready && (
          <Graph
            simple
            minimal
            playing={playing}
            transport={continuousAudio}
            onSeek={(beat) => continuousAudio.seek(beat)}
            onError={notify}
            onSampled={sampled}
          />
        )}
        <div
          className="one-equation"
          onKeyDownCapture={(e) => {
            if (
              !(e.target instanceof HTMLElement) ||
              !e.target.closest(".cm-editor")
            )
              return;
            if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
              e.preventDefault();
              e.stopPropagation();
              if (!error) setEditing(false);
            }
          }}
        >
          {ready &&
            track &&
            (editing || error ? (
              <div className="simple-input">
                <span className="equation-prefix">y =</span>
                <EquationEditor
                  simple
                  autoFocus
                  value={track.expression}
                  symbols={[]}
                  onChange={changeExpression}
                />
              </div>
            ) : (
              <button
                className="equation-edit"
                aria-label="Edit equation"
                title="Click to edit equation"
                onClick={() => setEditing(true)}
              >
                <span
                  aria-label="Rendered equation"
                  dangerouslySetInnerHTML={{ __html: notation }}
                />
              </button>
            ))}
          <div className="equation-actions">
            <button
              className="equation-play"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!ready || (!playing && (!graphReady || !!error))}
              onClick={() => {
                if (!error) setEditing(false);
                void toggle();
              }}
            >
              {playing ? (
                <Pause size={12} fill="currentColor" />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
              {playing
                ? "Pause"
                : !graphReady && !message
                  ? "Loading…"
                  : "Play"}
            </button>
            <span>
              {editing
                ? "Enter to finish. x is time; y is pitch."
                : "Click the equation to edit."}
            </span>
          </div>
          {(error || message) && (
            <p className="equation-error" role="alert">
              {error || message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
