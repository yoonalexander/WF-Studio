import { useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { sounds, soundCategories } from "../sounds";
import type { SoundId, SoundPreset } from "../sounds";

function WaveIcon({ sound }: { sound: SoundPreset }) {
  const points = Array.from({ length: 49 }, (_, i) => {
    const phase = (i / 48) * 2;
    const value =
      sound.waveform === "sawtooth"
        ? 2 * (phase % 1) - 1
        : sound.waveform === "square"
          ? phase % 1 < 0.5
            ? 0.8
            : -0.8
          : sound.waveform === "triangle"
            ? 1 - 4 * Math.abs((phase % 1) - 0.5)
            : Math.sin(phase * 2 * Math.PI);
    return `${i},${10 - value * 7}`;
  }).join(" ");
  return (
    <svg className="sound-wave-icon" viewBox="0 0 48 20" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

export function SoundLibrary({
  value,
  onChange,
  onClose,
}: {
  value: SoundId;
  onChange: (id: SoundId) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState<(typeof soundCategories)[number]>("All");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const selected = element?.querySelector<HTMLButtonElement>(
      ".sound-option[aria-pressed=true]",
    );
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
    return () => element?.close();
  }, []);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const words = query.trim().toLowerCase().split(/\s+/);
  const visible = sounds.filter(
    (sound) =>
      (category === "All" || sound.category === category) &&
      words.every((word) =>
        `${sound.name} ${sound.description} ${sound.category}`
          .toLowerCase()
          .includes(word),
      ),
  );
  return (
    <dialog
      ref={dialog}
      className="sound-options"
      id="sound-options"
      aria-label="Choose a sound"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const targets = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>("button,input"),
        );
        const first = targets[0],
          last = targets[targets.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          close();
      }}
    >
      <div className="sound-options-heading">
        <div>
          <h2>Sound library</h2>
          <p>Choose a voice for your equation.</p>
        </div>
        <button aria-label="Close sound options" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <div className="sound-library-tools">
        <label className="sound-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search sounds"
            placeholder="Search sounds…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div
          className="sound-families"
          role="group"
          aria-label="Sound families"
        >
          {soundCategories.map((family) => (
            <button
              key={family}
              aria-pressed={family === category}
              onClick={() => setCategory(family)}
            >
              {family}
            </button>
          ))}
        </div>
      </div>
      <div className="sound-library-results" aria-live="polite">
        {visible.length} {visible.length === 1 ? "sound" : "sounds"}
      </div>
      <div className="sound-grid">
        {visible.map((sound) => (
          <button
            key={sound.id}
            className="sound-option"
            aria-label={sound.name}
            aria-pressed={value === sound.id}
            onClick={() => {
              onChange(sound.id);
              close();
            }}
          >
            <div className="sound-option-top">
              <WaveIcon sound={sound} />
              <span>{sound.category}</span>
              {value === sound.id && <Check size={15} />}
            </div>
            <strong>{sound.name}</strong>
            <small>{sound.description}</small>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="sound-empty">
            No sounds match. Try another name or choose All.
          </p>
        )}
      </div>
      <div className="sound-library-footer">
        Classic synths, reimagined. Your equation sets the pitch.
      </div>
    </dialog>
  );
}
