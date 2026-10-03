import { useEffect, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { continuousAudio } from "../continuous-audio";

const volumeKey = "wf-equation-volume";
export function VolumeControl() {
  const [setting, setSetting] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(volumeKey) ?? "null");
      if (
        saved &&
        typeof saved.volume === "number" &&
        Number.isFinite(saved.volume)
      )
        return {
          volume: Math.max(0, Math.min(100, saved.volume)),
          muted: saved.muted === true,
        };
    } catch {
      /* Storage is optional. */
    }
    return { volume: 100, muted: false };
  });
  const silent = setting.muted || setting.volume === 0;
  useEffect(() => {
    continuousAudio.setVolume(silent ? 0 : setting.volume / 100);
    try {
      localStorage.setItem(volumeKey, JSON.stringify(setting));
    } catch {
      /* Storage is optional. */
    }
  }, [setting, silent]);
  return (
    <div className="equation-volume" role="group" aria-label="Volume controls">
      <button
        aria-label={silent ? "Unmute sound" : "Mute sound"}
        aria-pressed={silent}
        title={silent ? "Unmute sound" : "Mute sound"}
        onClick={() =>
          setSetting((s) => ({
            volume: s.volume || 100,
            muted: !silent,
          }))
        }
      >
        {silent ? (
          <VolumeX size={16} />
        ) : setting.volume <= 50 ? (
          <Volume1 size={16} />
        ) : (
          <Volume2 size={16} />
        )}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={silent ? 0 : setting.volume}
        aria-label="Volume"
        aria-valuetext={silent ? "Muted" : `${setting.volume}%`}
        title={silent ? "Muted" : `Volume ${setting.volume}%`}
        style={
          {
            "--volume": `${silent ? 0 : setting.volume}%`,
          } as React.CSSProperties
        }
        onChange={(e) =>
          setSetting({ volume: Number(e.target.value), muted: false })
        }
      />
    </div>
  );
}
