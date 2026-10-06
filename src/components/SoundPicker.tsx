import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Expand } from "lucide-react";
import { SoundLibrary } from "./SoundLibrary";
import { sounds, soundPreset } from "../sounds";
import type { SoundId } from "../sounds";

export function SoundPicker({
  value,
  onChange,
}: {
  value: SoundId;
  onChange: (id: SoundId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState({ serial: 0, direction: "down" });
  const root = useRef<HTMLDivElement>(null),
    expand = useRef<HTMLButtonElement>(null);
  const current = soundPreset(value),
    index = sounds.findIndex((sound) => sound.id === current.id);
  const roll = (direction: number) => {
    onChange(sounds[(index + direction + sounds.length) % sounds.length].id);
    setMotion((m) => ({
      serial: m.serial + 1,
      direction: direction > 0 ? "down" : "up",
    }));
  };
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
        if (
          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
          (e.target as HTMLElement).closest(".sound-wheel")
        ) {
          e.preventDefault();
          roll(e.key === "ArrowDown" ? 1 : -1);
        }
      }}
    >
      <div className="sound-wheel" role="group" aria-label="Sound selector">
        <div className="sound-wheel-window" aria-hidden="true">
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
        </div>
        <button
          className="sound-wheel-up"
          aria-label="Previous sound"
          title="Previous sound · scroll up"
          onClick={() => roll(-1)}
        >
          <ChevronUp size={10} />
        </button>
        <button
          className="sound-wheel-down"
          aria-label="Next sound"
          title="Next sound · scroll down"
          onClick={() => roll(1)}
        >
          <ChevronDown size={10} />
        </button>
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
        onClick={() => setOpen((v) => !v)}
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
