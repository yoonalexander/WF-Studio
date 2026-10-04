import { useEffect, useRef, useState } from "react";
import { scaleValue, scrollScale } from "../axis-scale";

export function ScaleKnob({
  axis,
  value,
  onChange,
}: {
  axis: "x" | "y";
  value: number;
  onChange: (value: number) => void;
}) {
  const control = useRef<HTMLDivElement>(null);
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const previous = useRef(value);
  const drag = useRef<{ y: number; value: number } | undefined>(undefined);
  const [angle, setAngle] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const delta = value - previous.current;
    if (delta !== 0)
      setAngle(
        (a) =>
          a +
          Math.sign(delta) *
            Math.min(
              240,
              Math.max(
                2,
                (Math.abs(delta) / Math.max(1, previous.current)) * 90,
              ),
            ),
      );
    previous.current = value;
  }, [value]);
  useEffect(() => {
    const node = control.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("input")) return;
      event.preventDefault();
      event.stopPropagation();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      current.current.onChange(scrollScale(current.current.value, delta));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const commit = () => {
    const number = draft.trim() ? scaleValue(Number(draft)) : undefined;
    if (number !== undefined) onChange(number);
    setEditing(false);
  };
  const label = `${axis.toUpperCase()} axis scale`;
  return (
    <div className={`scale-knob scale-knob-${axis}`}>
      <div
        ref={control}
        className="scale-dial"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuenow={value}
        aria-valuetext={`From ${-value} to ${value}`}
        aria-describedby="scale-help"
        tabIndex={0}
        title="Scroll to turn. Click the number to type."
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const delta = (
            {
              ArrowUp: -100,
              ArrowRight: -100,
              ArrowDown: 100,
              ArrowLeft: 100,
              PageUp: -1000,
              PageDown: 1000,
            } as Record<string, number>
          )[event.key];
          if (delta !== undefined) {
            event.preventDefault();
            onChange(scrollScale(value, delta));
          } else if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDraft(String(value));
            setEditing(true);
          }
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button,input")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { y: event.clientY, value };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          onChange(
            scrollScale(
              drag.current.value,
              (event.clientY - drag.current.y) * 6,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = undefined;
        }}
        onPointerCancel={() => {
          drag.current = undefined;
        }}
      >
        <span
          className="scale-rotor"
          aria-hidden="true"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {axis === "x" ? (
            <svg viewBox="0 0 72 72" className="scale-arc">
              <circle cx="36" cy="36" r="28" />
            </svg>
          ) : (
            <i className="scale-dot" />
          )}
        </span>
        <span className="scale-face" aria-hidden="true" />
        {editing ? (
          <input
            autoFocus
            className="scale-number"
            aria-label={`${axis.toUpperCase()} scale value`}
            inputMode="decimal"
            value={draft}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="scale-number"
            aria-label={`Edit ${axis.toUpperCase()} scale`}
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {Number(value.toPrecision(5))}
          </button>
        )}
      </div>
      <span className="scale-label">{axis}</span>
    </div>
  );
}
