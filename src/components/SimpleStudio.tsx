import { useMemo, useState } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  ArrowUpRight,
  Plus,
  Volume2,
  VolumeX,
  X,
  Undo2,
  Redo2,
} from "lucide-react";
import katex from "katex";
import { useStudio } from "../store";
import { audio } from "../audio";
import { makeTrack } from "../model";
import type { Track } from "../model";
import type { MathEngine } from "../math";
import { soundState, noteName } from "../simple";
import { simpleColor } from "../graph-render";
import { Graph } from "./Graph";
import { EquationEditor } from "./EquationEditor";

const instruments = [
  ["synth", "Melody"],
  ["bass", "Bass"],
  ["kick", "Kick drum"],
  ["snare", "Snare"],
  ["hat", "Hi-hat"],
  ["open-hat", "Open hi-hat"],
  ["clap", "Clap"],
] as const;
const beatOptions = [
  [0.125, "⅛ beat"],
  [0.25, "¼ beat"],
  [0.5, "½ beat"],
  [1, "1 beat"],
  [2, "2 beats"],
  [4, "4 beats"],
] as const;

export function SimpleStudio({
  engine,
  playing,
  ready,
  status,
  beat,
  onPlay,
  onStop,
  onSeek,
  onError,
  onDetailed,
  onHome,
  onExamples,
  onHelp,
  onNew,
  onProjects,
  onExport,
}: {
  engine: MathEngine;
  playing: boolean;
  ready: boolean;
  status: string;
  beat: number;
  onPlay: () => void;
  onSeek: (beat: number) => void;
  onError: (message: string) => void;
  onStop: () => void;
  onDetailed: () => void;
  onHome: () => void;
  onExamples: () => void;
  onHelp: () => void;
  onNew: () => void;
  onProjects: () => void;
  onExport: () => void;
}) {
  const {
    project,
    selectedId,
    track: update,
    select,
    change,
    add,
    remove,
    undo,
    redo,
    past,
    future,
  } = useStudio();
  const [addType, setAddType] = useState<Track["instrument"]>("synth");
  const track = project.tracks.find((t) => t.id === selectedId);
  const notes = audio.soundingNotes();
  const section = project.sections.find(
    (s) => beat >= s.startBeat && beat < s.endBeat,
  );
  const notation = useMemo(() => {
    if (!track || !engine.tex[track.id] || engine.errors[track.id]) return "";
    try {
      return katex.renderToString(
        `${track.symbol}(x) = ${engine.tex[track.id]}`,
        {
          throwOnError: false,
          trust: false,
          output: "html",
          displayMode: true,
        },
      );
    } catch {
      return "";
    }
  }, [track, engine]);
  const patch = (p: Partial<Track>) => {
    if (track) update(track.id, p);
  };
  const trigger =
    track?.mapping === "trigger" ||
    track?.mapping === "gate" ||
    track?.mode === "event";
  const percussion = !!track && !["synth", "bass"].includes(track.instrument);
  return (
    <>
      <header className="simple-header">
        <span className="simple-wordmark">
          Song studio <small>Simple</small>
        </span>
        <input
          className="simple-song-name"
          aria-label="Project name"
          value={project.name}
          maxLength={100}
          onChange={(e) =>
            change((p) => {
              p.name = e.target.value || "My song";
            }, "project-name")
          }
        />
        <nav className="simple-navigation" aria-label="Song actions">
          <button onClick={onHome}>One equation</button>
          <button onClick={onNew}>New song</button>
          <button onClick={onExamples}>Examples</button>
          <button onClick={onProjects}>Projects</button>
          <button onClick={onExport}>Export</button>
          <button className="simple-detail-switch" onClick={onDetailed}>
            Detailed view <ArrowUpRight size={15} />
          </button>
        </nav>
      </header>
      <main className="simple-studio">
        <div className="simple-transport">
          <button
            className="simple-play"
            aria-label={playing ? "Pause" : "Play"}
            disabled={!ready || !project.tracks.length}
            onClick={onPlay}
          >
            {playing ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
          <button aria-label="Stop" title="Stop" onClick={onStop}>
            <Square size={14} />
          </button>
          <button
            aria-label="Restart"
            title="Restart"
            onClick={() =>
              onSeek(project.loop.enabled ? project.loop.startBeat : 0)
            }
          >
            <RotateCcw size={15} />
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
          <label className="simple-loop-length">
            Loop{" "}
            <select
              aria-label="Loop length"
              value={project.loop.endBeat - project.loop.startBeat}
              onChange={(e) => {
                change((p) => {
                  const length = Number(e.target.value);
                  p.loop.enabled = true;
                  p.loop.startBeat = 0;
                  p.loop.endBeat = length;
                  p.lengthBeats = Math.max(length, p.lengthBeats);
                });
                onSeek(0);
              }}
            >
              {[
                ...new Set([
                  4,
                  8,
                  16,
                  32,
                  64,
                  project.loop.endBeat - project.loop.startBeat,
                ]),
              ]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} beats
                  </option>
                ))}
            </select>
          </label>
          <span className="simple-beat" aria-label="Playback position">
            x = {beat.toFixed(2)} beats
            {section ? ` · ${section.name}` : ""}
          </span>
          <div className="simple-history">
            <button
              aria-label="Undo"
              title="Undo"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={16} />
            </button>
            <button
              aria-label="Redo"
              title="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>
        {project.sections.length > 0 && (
          <div className="simple-arrangement-notice">
            This song has sections: some sounds enter later.
            <button
              onClick={() =>
                change((p) => {
                  p.sections = [];
                })
              }
            >
              Play all sounds together
            </button>
          </div>
        )}
        <Graph simple playing={playing} onSeek={onSeek} onError={onError} />
        <p className="simple-graph-key">
          Curves = equations. Circles = notes. Filled circles = sounds playing
          now.
        </p>
        <section className="simple-sounds" aria-label="Your sounds">
          <div className="simple-sound-list">
            {project.tracks.map((t) => {
              const state = soundState(
                project,
                t,
                beat,
                playing,
                notes,
                engine.errors[t.id],
              );
              return (
                <div
                  key={t.id}
                  className={`simple-sound ${t.id === selectedId ? "selected" : ""}`}
                  style={{ "--sound": simpleColor(t) } as React.CSSProperties}
                  data-sound-state={state}
                >
                  <button
                    className="simple-sound-select"
                    aria-label={`Select ${t.name} ${t.symbol}`}
                    onClick={() => select(t.id)}
                  >
                    <i
                      className={state.startsWith("Playing") ? "sounding" : ""}
                    />
                    <span>
                      <strong>{t.name}</strong>
                      <small>
                        {t.symbol}(x) · {state}
                      </small>
                    </span>
                  </button>
                  <button
                    aria-label={`Mute ${t.name} ${t.symbol}`}
                    title="Mute"
                    aria-pressed={t.muted}
                    onClick={() => update(t.id, { muted: !t.muted })}
                  >
                    {t.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <button
                    className="simple-solo"
                    aria-label={`Solo ${t.name} ${t.symbol}`}
                    title="Hear only this sound"
                    aria-pressed={t.solo}
                    onClick={() =>
                      update(t.id, {
                        solo: !t.solo,
                        muted: !t.solo ? false : t.muted,
                      })
                    }
                  >
                    S
                  </button>
                  <button
                    aria-label={`Remove ${t.name} ${t.symbol}`}
                    title="Remove sound (Undo restores it)"
                    onClick={() => remove(t.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="simple-add-sound">
            <select
              aria-label="New sound instrument"
              value={addType}
              onChange={(e) =>
                setAddType(e.target.value as Track["instrument"])
              }
            >
              {instruments.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <button
              disabled={project.tracks.length >= 32}
              onClick={() => add(addType)}
            >
              <Plus size={14} />
              {project.tracks.length ? "Add sound" : "Add your first equation"}
            </button>
          </div>
        </section>
        <section className="simple-equation" aria-label="Equation">
          {track && (
            <>
              <div className="simple-editor-heading">
                <input
                  aria-label="Sound name"
                  maxLength={60}
                  value={track.name}
                  onChange={(e) => patch({ name: e.target.value || "Sound" })}
                />
                <span>
                  {track.mapping === "visual"
                    ? "Graph only"
                    : trigger
                      ? `Hits when the equation ${track.crossing === "falling" ? "falls below" : track.crossing === "either" ? "crosses" : track.crossing === "change" ? "changes integer" : "rises above"} ${track.threshold}`
                      : `Equation sets ${track.mapping === "pitch" ? "pitch" : track.mapping} · one note every ${track.interval} beat${track.interval === 1 ? "" : "s"}`}
                </span>
              </div>
              <div
                className="simple-notation"
                aria-label="Rendered equation"
                dangerouslySetInnerHTML={{ __html: notation }}
              />
              <div
                className={`simple-input ${engine.errors[track.id] ? "invalid" : ""}`}
              >
                <span className="equation-prefix" aria-hidden="true">
                  {track.symbol}(x) =
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
              <div className="simple-sound-settings">
                <label>
                  Sound{" "}
                  <select
                    aria-label="Sound instrument"
                    value={track.instrument}
                    onChange={(e) => {
                      const defaults = makeTrack(
                        e.target.value as Track["instrument"],
                      );
                      patch({
                        instrument: defaults.instrument,
                        mapping: defaults.mapping,
                        mode: defaults.mode,
                        waveform: defaults.waveform,
                        baseNote: defaults.baseNote,
                        cutoff: defaults.cutoff,
                      });
                    }}
                  >
                    {instruments.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Equation controls{" "}
                  <select
                    aria-label="Equation controls"
                    value={track.mapping}
                    onChange={(e) =>
                      patch({
                        mapping: e.target.value as Track["mapping"],
                        mode: ["trigger", "gate"].includes(e.target.value)
                          ? "event"
                          : "control",
                      })
                    }
                  >
                    {(!percussion || track.mapping === "pitch") && (
                      <option value="pitch" disabled={percussion}>
                        Pitch
                      </option>
                    )}
                    <option value="trigger">Hits</option>
                    {(!percussion || track.mapping === "gate") && (
                      <option value="gate" disabled={percussion}>
                        Hold notes
                      </option>
                    )}
                    <option value="amplitude">Volume</option>
                    {(!percussion || track.mapping === "filter") && (
                      <option value="filter" disabled={percussion}>
                        Brightness
                      </option>
                    )}
                    <option value="pan">Stereo position</option>
                    <option value="visual">Graph only</option>
                  </select>
                </label>
                {trigger ? (
                  <label>
                    Threshold{" "}
                    <input
                      aria-label="Hit threshold"
                      type="number"
                      min={-1000}
                      max={1000}
                      step={0.1}
                      value={track.threshold}
                      onChange={(e) =>
                        patch({
                          threshold: Math.max(
                            -1000,
                            Math.min(1000, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                ) : (
                  <>
                    <label>
                      Note every{" "}
                      <select
                        aria-label="Note interval"
                        value={track.interval}
                        onChange={(e) =>
                          patch({ interval: Number(e.target.value) })
                        }
                      >
                        {beatOptions.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Root{" "}
                      <select
                        aria-label="Root note"
                        value={track.baseNote}
                        onChange={(e) =>
                          patch({ baseNote: Number(e.target.value) })
                        }
                      >
                        {Array.from({ length: 97 }, (_, i) => i + 12).map(
                          (n) => (
                            <option key={n} value={n}>
                              {noteName(n)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </>
                )}
                <label>
                  Volume{" "}
                  <input
                    aria-label="Sound volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={track.volume}
                    onChange={(e) => patch({ volume: Number(e.target.value) })}
                  />
                </label>
              </div>
              {!percussion && (
                <div className="simple-sound-settings simple-melody-settings">
                  <label>
                    Scale{" "}
                    <select
                      aria-label="Scale"
                      value={track.scale}
                      onChange={(e) =>
                        patch({ scale: e.target.value as Track["scale"] })
                      }
                    >
                      <option value="chromatic">All notes</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="pentatonic">Pentatonic</option>
                      <option value="harmonic-minor">Harmonic minor</option>
                    </select>
                  </label>
                  <label>
                    Note length{" "}
                    <input
                      aria-label="Note length"
                      type="number"
                      min={0.05}
                      max={4}
                      step={0.05}
                      value={track.noteLength}
                      onChange={(e) =>
                        patch({
                          noteLength: Math.max(
                            0.05,
                            Math.min(4, Number(e.target.value) || 0.05),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Tone{" "}
                    <select
                      aria-label="Tone"
                      value={track.waveform}
                      onChange={(e) =>
                        patch({ waveform: e.target.value as Track["waveform"] })
                      }
                    >
                      <option value="sine">Sine</option>
                      <option value="triangle">Triangle</option>
                      <option value="sawtooth">Sawtooth</option>
                      <option value="square">Square</option>
                    </select>
                  </label>
                </div>
              )}
              {(track.transform.shift !== 0 ||
                track.transform.speed !== 1 ||
                track.transform.gain !== 1 ||
                track.transform.offset !== 0) && (
                <div className="simple-arrangement-notice">
                  Graph and notes also use shift {track.transform.shift}, speed{" "}
                  {track.transform.speed}×, gain {track.transform.gain}× and
                  offset {track.transform.offset}.
                  <button
                    onClick={() =>
                      patch({
                        transform: { shift: 0, speed: 1, gain: 1, offset: 0 },
                      })
                    }
                  >
                    Reset transform
                  </button>
                </div>
              )}
            </>
          )}
          <div className="simple-bottom">
            <span>{status}</span>
            <button onClick={onHelp}>Equation help</button>
          </div>
          <p className="simple-hint">
            x is time in beats. Try sin(x), x mod 4, or reference another sound
            with {project.tracks[0]?.symbol ?? "M"}(x).
          </p>
        </section>
      </main>
    </>
  );
}
