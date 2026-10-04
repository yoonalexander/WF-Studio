import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Pause, ArrowUpRight, Dices } from "lucide-react";
import katex from "katex";
import { useStudio } from "../store";
import { newSimpleSong } from "../simple";
import { createMathEngine } from "../math";
import { continuousAudio } from "../continuous-audio";
import { Graph } from "./Graph";
import { EquationEditor } from "./EquationEditor";
import { randomEquation } from "../random-equation";
import { BoundsEditor } from "./BoundsEditor";
import { readCases, writeCases, previewExtent } from "../bounds";
import { SoundPicker } from "./SoundPicker";
import { VolumeControl } from "./VolumeControl";
import { soundKey, soundPreset } from "../sounds";
import type { SoundId } from "../sounds";
import { useAppearance } from "../appearance";
import { ThemeSwitch } from "./ThemeSwitch";

const draftKey = "wf-one-equation";
export function EquationPlayground({ onStudio }: { onStudio: () => void }) {
  const { project, load, change } = useStudio();
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false);
  const [graphReady, setGraphReady] = useState(false);
  const [boundsEditing, setBoundsEditing] = useState(false);
  const [sound, setSound] = useState<SoundId>(() => {
    try {
      return soundPreset(localStorage.getItem(soundKey)).id;
    } catch {
      return "electro";
    }
  });
  const [theme, setTheme] = useAppearance();
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
    single.lengthBeats = single.loop.endBeat = previewExtent(
      single.tracks[0].expression,
    );
    load(single);
    setReady(true);
    return () => continuousAudio.pause();
  }, [load]);
  const engine = useMemo(
    () => createMathEngine(project.tracks, project.beatsPerBar),
    [project.tracks, project.beatsPerBar],
  );
  const track = project.tracks[0];
  const hasCases = useMemo(() => {
    try {
      return !!readCases(track?.expression ?? "");
    } catch {
      return false;
    }
  }, [track?.expression]);
  const error = ready && track ? engine.errors[track.id] : undefined;
  useEffect(() => {
    if (ready) continuousAudio.update(project);
  }, [project, ready]);
  useEffect(() => {
    continuousAudio.setSound(sound);
  }, [sound]);
  const changeExpression = (expression: string) => {
    if (!track) return;
    setGraphReady(false);
    setMessage("");
    change((p) => {
      p.tracks[0].expression = expression;
      p.lengthBeats = p.loop.endBeat = previewExtent(expression);
    }, "one-equation");
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
    <div className="app simple-app equation-page" data-theme={theme}>
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
            appearance={theme}
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
              !e.target.closest(".cm-editor,.bounds-editor input")
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
              boundsEditing ? (
                <BoundsEditor
                  value={track.expression}
                  onChange={changeExpression}
                />
              ) : (
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
              )
            ) : (
              <button
                className="equation-edit"
                aria-label="Edit equation"
                title="Click to edit equation"
                onClick={() => {
                  try {
                    setBoundsEditing(!!readCases(track.expression));
                  } catch {
                    setBoundsEditing(false);
                  }
                  setEditing(true);
                }}
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
            {(editing || error) && !boundsEditing && (
              <button
                className="equation-bounds"
                disabled={!!error}
                onClick={() => {
                  if (!hasCases)
                    changeExpression(
                      writeCases([
                        { expression: track.expression, condition: "x < 0" },
                        {
                          expression: `-(${track.expression})`,
                          condition: "",
                          otherwise: true,
                        },
                      ]),
                    );
                  setBoundsEditing(true);
                  setEditing(true);
                }}
              >
                {hasCases ? "Edit bounds" : "Add bounds"}
              </button>
            )}
            {(editing || error) && boundsEditing && (
              <button
                className="equation-bounds"
                onClick={() => setBoundsEditing(false)}
              >
                Edit as text
              </button>
            )}
            <button
              className="equation-random"
              aria-label="Random equation"
              title="Try a random equation"
              disabled={!ready}
              onClick={() => {
                changeExpression(randomEquation(track.expression));
                setBoundsEditing(false);
                setEditing(false);
              }}
            >
              <Dices size={16} />
              Random
            </button>
            <div className="equation-sound-controls">
              <SoundPicker
                value={sound}
                onChange={(id) => {
                  setSound(id);
                  try {
                    localStorage.setItem(soundKey, id);
                  } catch {
                    /* Storage is optional. */
                  }
                }}
              />
              <VolumeControl />
            </div>
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
      <footer className="equation-footer">
        <a href="https://alexyoon.com">
          alexyoon.com <ArrowUpRight size={12} />
        </a>
        <ThemeSwitch appearance={theme} onChange={setTheme} />
      </footer>
    </div>
  );
}
