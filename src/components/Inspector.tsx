import { useMemo, useState } from "react";
import { Copy, Trash2, ArrowRight, ChevronDown } from "lucide-react";
import katex from "katex";
import { useStudio } from "../store";
import { validSymbol } from "../math";
import type { MathEngine } from "../math";
import type { Track } from "../model";
import { EquationEditor } from "./EquationEditor";
import { soundPresets } from "../presets";
import { isEquationEvent } from "../music";
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Range({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function Inspector({ engine }: { engine: MathEngine }) {
  const { project, selectedId, track: update, duplicate, remove } = useStudio(),
    track = project.tracks.find((t) => t.id === selectedId),
    [tab, setTab] = useState("mapping"),
    [symbolError, setSymbolError] = useState("");
  const notation = useMemo(() => {
    if (!track || !engine.tex[track.id]) return "";
    try {
      return katex.renderToString(
        `${track.symbol}(x) = ${engine.tex[track.id]}`,
        { throwOnError: false, trust: false, output: "html" },
      );
    } catch {
      return "";
    }
  }, [track, engine]);
  if (!track)
    return (
      <div className="inspector empty">
        <h2>Your first equation starts here.</h2>
        <p>
          Add an instrument on the left, or choose a composition from Examples.
        </p>
      </div>
    );
  const patch = (p: Partial<Track>, key?: string) =>
    update(track.id, p, key ? `${track.id}-${key}` : undefined);
  return (
    <section className="inspector" aria-label="Track inspector">
      <div className="inspector-title">
        <span className="track-dot" style={{ background: track.color }} />
        <h2>{track.name}</h2>
        <span className="pill">
          {track.mode === "event" ? "EVENT" : "CONTROL"}
        </span>
        <div className="spacer" />
        <button
          className="icon-button"
          disabled={project.tracks.length >= 32}
          aria-label="Duplicate track"
          onClick={() => duplicate(track.id)}
        >
          <Copy size={16} />
        </button>
        <button
          className="icon-button danger"
          aria-label="Delete track"
          onClick={() => remove(track.id)}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="equation-heading">
        <span className="eyebrow">EQUATION</span>
        <span className="subtle">
          Try pulse(1, 0.1) or sequence(0, 3, 5, 7)
        </span>
      </div>
      <EquationEditor
        key={track.id}
        value={track.expression}
        onChange={(expression) => patch({ expression }, "expression")}
        symbols={project.tracks.map((t) => t.symbol)}
      />
      {engine.errors[track.id] ? (
        <p className="inline-error" role="alert">
          {engine.errors[track.id]}
        </p>
      ) : (
        <div
          className="notation"
          dangerouslySetInnerHTML={{ __html: notation }}
        />
      )}
      <div className="mapping-flow">
        <span>Equation</span>
        <ArrowRight size={12} />
        <span>Value</span>
        <ArrowRight size={12} />
        <span>{track.mapping}</span>
        <ArrowRight size={12} />
        <span>{track.mapping === "visual" ? "Graph" : track.instrument}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Track settings">
        {["mapping", "instrument", "transform"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div
        className="inspector-fields"
        role="tabpanel"
        aria-label={`${tab} settings`}
      >
        {tab === "mapping" && (
          <>
            <Field label="Track name">
              <input
                aria-label="Track name"
                maxLength={60}
                value={track.name}
                onChange={(e) =>
                  patch({ name: e.target.value || "Track" }, "name")
                }
              />
            </Field>
            <Field label="Function name">
              <input
                aria-label="Function name"
                maxLength={16}
                value={track.symbol}
                onChange={(e) => {
                  const symbol = e.target.value;
                  if (
                    !validSymbol(symbol) ||
                    project.tracks.some(
                      (t) => t.id !== track.id && t.symbol === symbol,
                    )
                  ) {
                    setSymbolError(
                      "Use a unique letter/name, such as K or Lead.",
                    );
                    return;
                  }
                  setSymbolError("");
                  patch({ symbol });
                }}
              />
            </Field>
            {symbolError && <p className="inline-error">{symbolError}</p>}
            <Field label="Mode">
              <select
                value={track.mode}
                onChange={(e) =>
                  patch({ mode: e.target.value as Track["mode"] })
                }
              >
                <option value="control">Control · continuous value</option>
                <option value="event">Event · crossings</option>
              </select>
            </Field>
            <Field label="Map value to">
              <select
                aria-label="Map value to"
                value={track.mapping}
                onChange={(e) => {
                  const mapping = e.target.value as Track["mapping"];
                  patch({
                    mapping,
                    mode: ["trigger", "gate"].includes(mapping)
                      ? "event"
                      : "control",
                  });
                }}
              >
                {[
                  "pitch",
                  "trigger",
                  "gate",
                  "amplitude",
                  "filter",
                  "pan",
                  "visual",
                ].map((m) => (
                  <option key={m} value={m}>
                    {
                      (
                        {
                          pitch: "Pitch · melody",
                          trigger: "Trigger · drum hits",
                          gate: "Gate · hold notes",
                          amplitude: "Amplitude · volume",
                          filter: "Filter · brightness",
                          pan: "Pan · stereo position",
                          visual: "Visual only",
                        } as Record<string, string>
                      )[m]
                    }
                  </option>
                ))}
              </select>
            </Field>
            {track.mode === "event" ||
            track.mapping === "trigger" ||
            track.mapping === "gate" ? (
              <>
                <Range
                  label="Threshold"
                  value={track.threshold}
                  min={-8}
                  max={8}
                  onChange={(threshold) => patch({ threshold }, "threshold")}
                />
                <Field label="Trigger on">
                  <select
                    value={track.crossing}
                    onChange={(e) =>
                      patch({ crossing: e.target.value as Track["crossing"] })
                    }
                  >
                    <option value="rising">Rising edge</option>
                    <option value="falling">Falling edge</option>
                    <option value="either">Either edge</option>
                    <option value="change">Integer transition</option>
                  </select>
                </Field>
              </>
            ) : (
              <p className="hint">
                Sound follows the equation continuously. Use sequence, floor or
                quantize for steps, and bounds for rests.
              </p>
            )}
            <Field label="Root MIDI note">
              <input
                aria-label="Root MIDI note"
                type="number"
                min={12}
                max={108}
                value={track.baseNote}
                onChange={(e) =>
                  patch({
                    baseNote: Math.max(
                      12,
                      Math.min(108, Math.round(Number(e.target.value))),
                    ),
                  })
                }
              />
            </Field>
            {isEquationEvent(track) && track.mapping === "pitch" && (
              <Field label="Scale lock">
                <select
                  aria-label="Scale lock"
                  value={track.scale}
                  onChange={(e) =>
                    patch({ scale: e.target.value as Track["scale"] })
                  }
                >
                  {[
                    "chromatic",
                    "major",
                    "minor",
                    "harmonic-minor",
                    "pentatonic",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}
            {isEquationEvent(track) && (
              <Range
                label="Note length"
                value={track.noteLength}
                min={0.05}
                max={4}
                onChange={(noteLength) => patch({ noteLength }, "length")}
                unit=" beats"
              />
            )}
            {["amplitude", "filter", "pan"].includes(track.mapping) && (
              <>
                <Field label="Input minimum">
                  <input
                    type="number"
                    value={track.inputMin}
                    min={-1000}
                    max={track.inputMax - 0.01}
                    onChange={(e) =>
                      patch({
                        inputMin: Math.max(
                          -1000,
                          Math.min(
                            track.inputMax - 0.01,
                            Number(e.target.value),
                          ),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Input maximum">
                  <input
                    type="number"
                    value={track.inputMax}
                    min={track.inputMin + 0.01}
                    max={1000}
                    onChange={(e) =>
                      patch({
                        inputMax: Math.min(
                          1000,
                          Math.max(
                            track.inputMin + 0.01,
                            Number(e.target.value),
                          ),
                        ),
                      })
                    }
                  />
                </Field>
              </>
            )}
          </>
        )}
        {tab === "instrument" && (
          <>
            <Field label="Sound preset">
              <select
                aria-label="Sound preset"
                value=""
                onChange={(e) => {
                  const preset = soundPresets.find(
                    (p) => p.name === e.target.value,
                  );
                  if (preset) patch(preset.settings);
                }}
              >
                <option value="">Choose a sound…</option>
                {soundPresets
                  .filter((p) => p.instrument === track.instrument)
                  .map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
              </select>
            </Field>
            <Field label="Instrument">
              <select
                aria-label="Instrument"
                value={track.instrument}
                onChange={(e) =>
                  patch({ instrument: e.target.value as Track["instrument"] })
                }
              >
                {[
                  "kick",
                  "snare",
                  "hat",
                  "open-hat",
                  "clap",
                  "synth",
                  "bass",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Oscillator">
              <select
                aria-label="Oscillator"
                value={track.waveform}
                onChange={(e) =>
                  patch({ waveform: e.target.value as Track["waveform"] })
                }
              >
                {["sine", "triangle", "sawtooth", "square"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Range
              label="Volume"
              value={track.volume}
              min={0}
              max={1}
              onChange={(volume) => patch({ volume }, "volume")}
            />
            <Range
              label="Pan"
              value={track.pan}
              min={-1}
              max={1}
              onChange={(pan) => patch({ pan }, "pan")}
            />
            <Range
              label="Filter cutoff"
              value={track.cutoff}
              min={40}
              max={16000}
              step={10}
              onChange={(cutoff) => patch({ cutoff }, "cutoff")}
              unit=" Hz"
            />
            <Range
              label="Detune"
              value={track.detune}
              min={-100}
              max={100}
              step={1}
              onChange={(detune) => patch({ detune }, "detune")}
              unit=" cents"
            />
            {isEquationEvent(track) &&
              (["attack", "decay", "sustain", "release"] as const).map((k) => (
                <Range
                  key={k}
                  label={k[0].toUpperCase() + k.slice(1)}
                  value={track[k]}
                  min={k === "sustain" ? 0 : k === "attack" ? 0.002 : 0.01}
                  max={k === "sustain" ? 1 : k === "release" ? 3 : 2}
                  onChange={(v) => patch({ [k]: v }, k)}
                  unit={k === "sustain" ? "" : " s"}
                />
              ))}
            <p className="hint">
              {isEquationEvent(track)
                ? "Oscillator and envelope controls apply to synths. Drum voices have tuned envelopes."
                : "Continuous sounds use the oscillator, volume, filter, pan and detune. Use the equation to shape their timing."}
            </p>
          </>
        )}
        {tab === "transform" && (
          <>
            {(["shift", "speed", "gain", "offset"] as const).map((k) => (
              <Range
                key={k}
                label={
                  {
                    shift: "Time shift",
                    speed: "Time scale",
                    gain: "Vertical scale",
                    offset: "Vertical shift",
                  }[k]
                }
                value={track.transform[k]}
                min={
                  k === "speed"
                    ? 0.125
                    : k === "shift"
                      ? -16
                      : k === "gain"
                        ? -8
                        : -16
                }
                max={k === "speed" || k === "gain" ? 8 : 16}
                step={k === "speed" ? 0.125 : 0.25}
                onChange={(v) =>
                  patch({ transform: { ...track.transform, [k]: v } }, k)
                }
              />
            ))}
            <p className="hint">
              g(x) = gain × f((x + shift) × speed) + offset. The original
              expression stays editable.
            </p>
            <button
              className="text-button"
              onClick={() =>
                patch({ transform: { shift: 0, speed: 1, gain: 1, offset: 0 } })
              }
            >
              Reset transformations
            </button>
            <Field label="Track color">
              <input
                aria-label="Track color"
                type="color"
                value={track.color}
                onChange={(e) => patch({ color: e.target.value })}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={track.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              Track enabled
            </label>
          </>
        )}
      </div>
      <details className="quick-help">
        <summary>
          <ChevronDown size={14} />
          Equation tips
        </summary>
        <p>
          <code>x mod 1</code> repeats each beat.{" "}
          <code>sequence(0, 3, 5, 7)</code> changes each beat.{" "}
          <code>pulse(0.5, 0.08)</code> makes two short pulses per beat.
        </p>
        <p>
          Use <code>piecewise(condition, value, fallback)</code>, or{" "}
          <code>K(x) + B(x + 1)</code> to combine and shift named functions.
        </p>
      </details>
    </section>
  );
}
