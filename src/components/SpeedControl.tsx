import { Gauge } from "lucide-react";

export function SpeedControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="equation-volume equation-speed">
      <Gauge size={16} aria-hidden="true" />
      <input
        type="range"
        min="0.25"
        max="4"
        step="0.05"
        value={value}
        aria-label="Playback speed"
        aria-valuetext={`${value}×`}
        title={`Playback speed ${value}×`}
        style={
          {
            "--volume": `${((value - 0.25) / 3.75) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{value.toFixed(2).replace(/\.?0+$/, "")}×</output>
    </label>
  );
}
