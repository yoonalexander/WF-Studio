import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronUp, ChevronDown, Expand, Dices } from "lucide-react";
import { SoundLibrary } from "./SoundLibrary";
import { sounds, soundPreset } from "../sounds";
import type { SoundId } from "../sounds";

const spinDuration = 1050;
type Spin = { target: SoundId; steps: number; labels: string[] };

export function SoundPicker({
  value,
  onChange,
}: {
  value: SoundId;
  onChange: (id: SoundId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const hintId = useId();
  const [motion, setMotion] = useState({ serial: 0, direction: "down" });
  const [spin, setSpin] = useState<Spin | null>(null);
  const spinRef = useRef<Spin | null>(null),
    changeRef = useRef(onChange);
  changeRef.current = onChange;
  const root = useRef<HTMLDivElement>(null),
    expand = useRef<HTMLButtonElement>(null);
  const current = soundPreset(value),
    index = sounds.findIndex((sound) => sound.id === current.id);
  const roll = (direction: number) => {
    if (spinRef.current) return;
    onChange(sounds[(index + direction + sounds.length) % sounds.length].id);
    setMotion((m) => ({
      serial: m.serial + 1,
      direction: direction > 0 ? "down" : "up",
    }));
  };
  const finishSpin = () => {
    const pending = spinRef.current;
    if (!pending) return;
    spinRef.current = null;
    setSpin(null);
    changeRef.current(pending.target);
    // The final row is already centered; don't roll it a second time.
    setMotion((m) => ({ serial: m.serial + 1, direction: "still" }));
  };
  const cancelSpin = () => {
    spinRef.current = null;
    setSpin(null);
  };
  const randomize = () => {
    if (spinRef.current) return;
    // Each other sound is equally likely, with no immediate repeat.
    const offset = 1 + Math.floor(Math.random() * (sounds.length - 1));
    const target = sounds[(index + offset) % sounds.length].id;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onChange(target);
      setMotion((m) => ({ serial: m.serial + 1, direction: "still" }));
      return;
    }
    const steps = sounds.length + offset;
    const pending = {
      target,
      steps,
      labels: Array.from(
        { length: steps + 3 },
        (_, i) => sounds[(index + i - 1 + sounds.length) % sounds.length].name,
      ),
    };
    spinRef.current = pending;
    setSpin(pending);
  };
  useEffect(() => {
    if (!spin) return;
    // Finish even if motion preferences change or a browser omits animationend.
    const timer = window.setTimeout(finishSpin, spinDuration + 80);
    return () => window.clearTimeout(timer);
  }, [spin]);
  const rollRef = useRef(roll);
  rollRef.current = roll;
  useEffect(() => {
    const wheel = root.current?.querySelector(".sound-wheel");
    let last = -Infinity;
    const scroll = (event: Event) => {
      const e = event as WheelEvent;
      if (!e.deltaY) return;
      e.preventDefault();
      if (performance.now() - last < 180) return;
      last = performance.now();
      rollRef.current(e.deltaY > 0 ? 1 : -1);
    };
    wheel?.addEventListener("wheel", scroll, { passive: false });
    return () => wheel?.removeEventListener("wheel", scroll);
  }, []);
  return (
    <div
      className="sound-picker"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") setHintDismissed(true);
        if (
          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
          (e.target as HTMLElement).closest(".sound-wheel")
        ) {
          e.preventDefault();
          roll(e.key === "ArrowDown" ? 1 : -1);
        }
      }}
    >
      <div
        className="sound-wheel-control"
        data-hint-hidden={hintDismissed || !!spin || open}
        onMouseEnter={() => setHintDismissed(false)}
        onFocusCapture={() => setHintDismissed(false)}
      >
        <div
          className="sound-wheel"
          role="group"
          aria-label="Sound selector"
          aria-busy={!!spin}
          data-spinning={!!spin}
        >
          <button
            className="sound-wheel-random"
            aria-label="Random sound"
            aria-describedby={hintId}
            disabled={!!spin}
            onClick={randomize}
          >
            {!spin && <Dices size={13} />}
          </button>
          <div className="sound-wheel-window" aria-hidden="true">
            {spin ? (
              <div
                className="sound-spin-strip"
                style={
                  {
                    "--sound-spin-end": `${-spin.steps * 20 - 4}px`,
                    "--sound-spin-duration": `${spinDuration}ms`,
                  } as CSSProperties
                }
                onAnimationEnd={(e) => {
                  if (e.animationName === "sound-spin") finishSpin();
                }}
              >
                {spin.labels.map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
            ) : (
              <div
                className="sound-wheel-strip"
                key={motion.serial}
                data-direction={motion.direction}
              >
                <span>
                  {sounds[(index - 1 + sounds.length) % sounds.length].name}
                </span>
                <strong>{current.name}</strong>
                <span>{sounds[(index + 1) % sounds.length].name}</span>
              </div>
            )}
          </div>
          <button
            className="sound-wheel-up"
            aria-label="Previous sound"
            aria-describedby={hintId}
            disabled={!!spin}
            onClick={() => roll(-1)}
          >
            <ChevronUp size={10} />
          </button>
          <button
            className="sound-wheel-down"
            aria-label="Next sound"
            aria-describedby={hintId}
            disabled={!!spin}
            onClick={() => roll(1)}
          >
            <ChevronDown size={10} />
          </button>
        </div>
        <div className="sound-tooltip" role="tooltip" id={hintId}>
          {current.description}
        </div>
      </div>
      <span className="sr-only" role="status">
        Sound: {current.name}
      </span>
      <button
        className="sound-expand"
        ref={expand}
        aria-label="Expand sound options"
        title="Choose a sound"
        aria-expanded={open}
        aria-controls="sound-options"
        onClick={() => {
          cancelSpin();
          setOpen((v) => !v);
        }}
      >
        <Expand size={14} />
      </button>
      {open && (
        <SoundLibrary
          value={value}
          onChange={(id) => {
            onChange(id);
            setMotion((m) => ({ serial: m.serial + 1, direction: "down" }));
          }}
          onClose={() => {
            setOpen(false);
            expand.current?.focus();
          }}
        />
      )}
    </div>
  );
}
