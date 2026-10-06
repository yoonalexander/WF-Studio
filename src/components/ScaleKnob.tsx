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
  const drag = useRef<
    | {
        x: number;
        y: number;
        lastX: number;
        value: number;
        pointer: number;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const suppressClick = useRef(false);
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
        title="Scroll or drag left/right to turn. Click the number to type."
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
          if (!event.isPrimary) return;
          suppressClick.current = false;
          if ((event.target as HTMLElement).closest("input")) return;
          // Capture on the number button itself so a tap still opens editing,
          // while swipes can start anywhere and continue beyond the dial.
          const target =
            (event.target as HTMLElement).closest("button") ??
            event.currentTarget;
          target.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            lastX: event.clientX,
            value,
            pointer: event.pointerId,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const gesture = drag.current;
          if (!gesture || gesture.pointer !== event.pointerId) return;
          if (
            !gesture.moved &&
            Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4
          )
            return;
          gesture.moved = suppressClick.current = true;
          const dx = event.clientX - gesture.lastX;
          // Only horizontal movement turns the dial. Incremental movement
          // reverses immediately at zero, even outside the dial.
          gesture.value = scrollScale(gesture.value, -dx * 6);
          gesture.lastX = event.clientX;
          if (dx !== 0) onChange(gesture.value);
        }}
        onPointerUp={(event) => {
          const gesture = drag.current;
          if (!gesture || gesture.pointer !== event.pointerId) return;
          drag.current = undefined;
          if (
            !gesture.moved &&
            event.pointerType === "touch" &&
            (event.target as HTMLElement).closest("button")
          ) {
            // A browser can suppress the compatibility click after a swipe.
            // Handle touch taps directly, and discard any later duplicate click.
            setDraft(String(current.current.value));
            setEditing(true);
            suppressClick.current = true;
          }
        }}
        onPointerCancel={(event) => {
          if (drag.current?.pointer !== event.pointerId) return;
          drag.current = undefined;
          suppressClick.current = false;
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          if (event.detail === 0) return;
          event.preventDefault();
          event.stopPropagation();
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
