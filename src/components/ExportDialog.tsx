import { useRef, useState } from "react";
import { Download, Link, FileAudio, FileJson, Film, Music } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./Inspector";
import { useStudio } from "../store";
import { audio } from "../audio";
import type { PlaybackMode } from "../audio";
import {
  download,
  filename,
  encodeWav,
  encodeMidi,
  exportVideo,
} from "../exports";
import { shareUrl } from "../storage";
export function ExportDialog({
  close,
  notify,
  pause,
  playbackMode = "sequenced",
}: {
  close: () => void;
  notify: (s: string) => void;
  pause: () => void;
  playbackMode?: PlaybackMode;
}) {
  const project = useStudio((s) => s.project),
    [format, setFormat] = useState("wav"),
    [range, setRange] = useState("loop"),
    [aspect, setAspect] = useState<"wide" | "portrait" | "square">("wide"),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  const abort = useRef<AbortController | null>(null);
  const start = range === "loop" ? project.loop.startBeat : 0,
    end = range === "loop" ? project.loop.endBeat : project.lengthBeats,
    seconds = ((end - start) * 60) / project.bpm;
  const run = async () => {
    setError("");
    setBusy(true);
    pause();
    const snapshot = structuredClone(project);
    const base = filename(project.name);
    try {
      if (format === "json")
        download(
          new Blob([JSON.stringify(snapshot, null, 2)], {
            type: "application/json",
          }),
          `${base}.wf.json`,
        );
      else if (format === "midi")
        download(encodeMidi(snapshot, start, end), `${base}.mid`);
      else if (format === "wav")
        download(
          encodeWav(await audio.render(snapshot, start, end, playbackMode)),
          `${base}.wav`,
        );
      else if (format === "video") {
        abort.current = new AbortController();
        const result = await exportVideo(
          snapshot,
          start,
          end,
          aspect,
          abort.current.signal,
          setProgress,
          playbackMode,
        );
        download(result.blob, `${base}.${result.extension}`);
      } else {
        const url = await shareUrl(snapshot);
        setLink(url);
        try {
          await navigator.clipboard.writeText(url);
          notify("Project link copied. Opening it creates a remix.");
        } catch {
          notify("Project link ready. Select it below to copy.");
        }
      }
      if (format !== "link") notify("Export ready. Your download has started.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  return (
    <Modal
      title="Export your composition"
      close={() => {
        if (busy && format === "video") abort.current?.abort();
        if (!busy) close();
      }}
    >
      <p className="modal-description">
        Your music and equations stay on your device. Choose how to take them
        with you.
      </p>
      <div className="export-formats">
        {[
          {
            id: "wav",
            name: "WAV audio",
            icon: FileAudio,
            detail: "Stereo · 44.1 kHz",
          },
          {
            id: "midi",
            name: "MIDI",
            icon: Music,
            detail: "Notes, drums & tempo",
          },
          {
            id: "video",
            name: "Video",
            icon: Film,
            detail: "Animated graph + audio",
          },
          {
            id: "json",
            name: "Project file",
            icon: FileJson,
            detail: "Editable .wf.json",
          },
          {
            id: "link",
            name: "Remix link",
            icon: Link,
            detail: "Project inside the URL",
          },
        ].map((f) => (
          <button
            className={format === f.id ? "chosen" : ""}
            key={f.id}
            disabled={busy}
            onClick={() => {
              setFormat(f.id);
              setError("");
            }}
          >
            <f.icon size={22} />
            <strong>{f.name}</strong>
            <span>{f.detail}</span>
          </button>
        ))}
      </div>
      {["wav", "midi", "video"].includes(format) && (
        <div className="modal-fields">
          <Field label="Export range">
            <select
              disabled={busy}
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="loop">Loop range</option>
              <option value="song">Whole song</option>
            </select>
          </Field>
          <div className="export-duration">
            {seconds.toFixed(1)} seconds <span>+ audio tail for WAV/video</span>
          </div>
          {format === "video" && (
            <Field label="Video shape">
              <select
                disabled={busy}
                value={aspect}
                onChange={(e) => setAspect(e.target.value as typeof aspect)}
              >
                <option value="wide">16:9 · 1920 × 1080</option>
                <option value="portrait">9:16 · 1080 × 1920</option>
                <option value="square">1:1 · 1080 × 1080</option>
              </select>
            </Field>
          )}
        </div>
      )}
      {format === "video" && (
        <p className="hint">
          Video records in real time at 30 FPS. Keep this tab visible until it
          finishes. Chrome exports WebM; the format depends on your browser.
        </p>
      )}
      {format === "midi" && (
        <p className="hint">
          {playbackMode === "continuous"
            ? "MIDI converts the curves to discrete notes. Choose WAV or video to preserve continuous pitch and sound."
            : "MIDI carries notes and timing. Synth tones, filters, pan, and effects are reproduced by your destination instrument."}
        </p>
      )}
      {format === "link" && (
        <p className="hint">
          Anyone with this link can open and remix the composition. It contains
          the project; no account or server upload is needed.
        </p>
      )}
      {link && (
        <Field label="Remix link">
          <input
            aria-label="Remix link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {busy && (
        <div className="export-progress">
          <progress
            max={100}
            value={format === "video" ? progress : undefined}
          />
          <span>
            {format === "video"
              ? `Recording ${Math.round(progress)}%`
              : "Preparing export…"}
          </span>
        </div>
      )}
      <div className="modal-footer">
        <button
          className="text-button"
          disabled={busy && format !== "video"}
          onClick={() => (busy ? abort.current?.abort() : close())}
        >
          {busy ? "Cancel export" : "Cancel"}
        </button>
        <button
          className="primary"
          disabled={
            busy || (["wav", "video"].includes(format) && seconds > 180)
          }
          onClick={() => void run()}
        >
          <Download size={16} />
          {format === "link" ? "Create remix link" : "Export"}
        </button>
      </div>
      {seconds > 180 && ["wav", "video"].includes(format) && (
        <p className="inline-error">
          Choose a loop range under 3 minutes for audio/video export.
        </p>
      )}
    </Modal>
  );
}
