import { Sun, Moon } from "lucide-react";
import type { Appearance } from "../appearance";

export function ThemeSwitch({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (value: Appearance) => void;
}) {
  return (
    <div className="equation-theme" role="group" aria-label="Color theme">
      {(["light", "dark"] as const).map((choice) => (
        <button
          key={choice}
          aria-label={`${choice === "light" ? "Light" : "Dark"} mode`}
          aria-pressed={appearance === choice}
          title={`${choice === "light" ? "Light" : "Dark"} mode`}
          onClick={() => onChange(choice)}
        >
          {choice === "light" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      ))}
    </div>
  );
}
