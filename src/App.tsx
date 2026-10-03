import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Play,
  Pause,
  Square,
  RotateCcw,
  Save,
  Download,
  FolderOpen,
  Plus,
  Undo2,
  Redo2,
  HelpCircle,
  Music2,
  Radio,
  Repeat2,
  Check,
  X,
  Upload,
  SlidersHorizontal,
  ChevronRight,
  AudioLines,
  Keyboard,
} from "lucide-react";
import { useStudio } from "./store";
import { audio } from "./audio";
import { createMathEngine } from "./math";
import {
  exampleInfo,
  exampleProject,
  simpleExampleInfo,
  simpleExampleProject,
} from "./examples";
import { newSimpleSong } from "./simple";
import { newProject, validateProject } from "./model";
import type { Project, Track } from "./model";
import {
  loadActive,
  fromShare,
  listProjects,
  parseProjectFile,
  saveProject,
  db,
} from "./storage";
import { Graph } from "./components/Graph";
import { Inspector, Field, Range } from "./components/Inspector";
import { Timeline } from "./components/Timeline";
import { Modal } from "./components/Modal";
import { ExportDialog } from "./components/ExportDialog";
import { SimpleStudio } from "./components/SimpleStudio";
import { EquationPlayground } from "./components/EquationPlayground";

export default function App() {
  const [studio, setStudio] = useState(
    () =>
      location.pathname === "/studio" ||
      location.pathname === "/studio/" ||
      location.hash.startsWith("#project="),
  );
  useEffect(() => {
    const navigate = () =>
      setStudio(
        location.pathname === "/studio" ||
          location.pathname === "/studio/" ||
          location.hash.startsWith("#project="),
      );
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  const navigate = (next: boolean) => {
    history.pushState(null, "", next ? "/studio" : "/");
    setStudio(next);
  };
  return studio ? (
    <SongStudio onHome={() => navigate(false)} />
  ) : (
    <EquationPlayground onStudio={() => navigate(true)} />
  );
}

function SongStudio({ onHome }: { onHome: () => void }) {
  const {
    project,
    selectedId,
    select,
    change,
    track,
    add,
    undo,
    redo,
    past,
    future,
    load,
  } = useStudio();
  const [playing, setPlaying] = useState(false),
    [viewMode, setViewMode] = useState<"simple" | "detailed">(() => {
      try {
        return localStorage.getItem("wave-function-view") === "detailed"
          ? "detailed"
          : "simple";
      } catch {
        return "simple";
      }
    }),
    [beat, setBeat] = useState(0),
    [modal, setModal] = useState<
      "examples" | "library" | "help" | "export" | "settings" | null
    >(null),
    [welcome, setWelcome] = useState(true),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Loading local project…"),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState<Project[]>([]),
    [addType, setAddType] = useState<Track["instrument"]>("synth");
  const notify = useCallback((s: string) => setToast(s), []),
    file = useRef<HTMLInputElement>(null),
    initialized = useRef(false),
    saveRevision = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const engine = useMemo(
    () => createMathEngine(project.tracks, project.beatsPerBar),
    [project.tracks, project.beatsPerBar],
  );
  const latestProject = useRef(project);
  const canSave = useRef(false);
  latestProject.current = project;
  canSave.current = ready;
  useEffect(() => {
    audio.setMode(viewMode === "simple" ? "continuous" : "sequenced");
    setPlaying(audio.playing);
    setBeat(audio.position());
  }, [viewMode]);
  useEffect(
    () => () => {
      if (canSave.current)
        void saveProject(latestProject.current).catch(() => {});
    },
    [],
  );
  const pause = useCallback(() => {
    audio.pause();
    setPlaying(false);
    setBeat(audio.position());
  }, []);
  const toggle = useCallback(async () => {
    if (audio.playing) {
      pause();
      return;
    }
    try {
      await audio.play(useStudio.getState().project);
      setPlaying(audio.playing);
      setWelcome(false);
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Audio could not start. Try Play again.",
      );
    }
  }, [notify, pause]);
  const seek = useCallback((b: number) => {
    audio.seek(b);
    setBeat(audio.position());
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const shared = await fromShare(location.hash),
          local = shared ? undefined : await loadActive();
        if (shared || local) {
          load(shared ?? local!);
          setWelcome(false);
          if (shared) {
            history.replaceState(null, "", location.pathname);
            notify("Remix opened. Changes save to your own local copy.");
          }
        }
      } catch (e) {
        notify(
          `Could not restore project: ${e instanceof Error ? e.message : "unknown error"}. Your stored files have not been removed.`,
        );
      } finally {
        setReady(true);
      }
    })();
  }, [load, notify]);
  useEffect(() => {
    if (!ready) return;
    const revision = ++saveRevision.current;
    setStatus("Saving…");
    const timer = setTimeout(() => {
      void saveProject(project)
        .then(() => {
          if (revision === saveRevision.current)
            setStatus("Saved on this device");
        })
        .catch(() => {
          if (revision === saveRevision.current)
            setStatus("Save failed · export a project file");
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [project, ready]);
  useEffect(() => {
    audio.update(project);
  }, [project]);
  useEffect(() => {
    audio.onEnd = () => {
      setPlaying(false);
      setBeat(0);
    };
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      if (audio.playing && time - last > 70) {
        last = time;
        setBeat(Math.max(0, audio.position()));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      audio.pause();
    };
  }, []);
  useEffect(() => {
    clearTimeout(toastTimer.current);
    if (toast) toastTimer.current = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,.cm-editor,dialog")) return;
      if (e.code === "Space") {
        if (target.closest("button,a")) return;
        e.preventDefault();
        void toggle();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveProject(useStudio.getState().project)
          .then(() => notify("Project saved on this device."))
          .catch(() =>
            notify("Save failed. Export a project file to keep your work."),
          );
      }
      if (e.key === "Home") {
        e.preventDefault();
        seek(project.loop.enabled ? project.loop.startBeat : 0);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [toggle, undo, redo, notify, seek, project.loop]);
  const openLibrary = async () => {
    try {
      setSaved(await listProjects());
      setModal("library");
    } catch {
      notify(
        "Local project library is unavailable. Use a project file to save.",
      );
    }
  };
  const switchProject = async (p: Project) => {
    pause();
    try {
      await saveProject(useStudio.getState().project);
    } catch {
      notify(
        "The previous project could not be saved. Export it before switching.",
      );
      return;
    }
    load(p);
    audio.stop();
    seek(0);
    setModal(null);
    setWelcome(false);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      if (f.size > 1_000_000)
        throw new Error("Project files must be under 1 MB.");
      const p = parseProjectFile(await f.text());
      p.id = crypto.randomUUID();
      await switchProject(p);
    } catch (e) {
      notify(
        `Import failed: ${e instanceof Error ? e.message : "Invalid project"}`,
      );
    }
    if (file.current) file.current.value = "";
  };
  const selected = project.tracks.find((t) => t.id === selectedId);
  const switchView = (mode: "simple" | "detailed") => {
    setViewMode(mode);
    try {
      localStorage.setItem("wave-function-view", mode);
    } catch {
      /* View still works without storage. */
    }
  };
  const goHome = async () => {
    pause();
    try {
      await saveProject(useStudio.getState().project);
      onHome();
    } catch {
      notify("Save failed. Export your song before leaving the studio.");
    }
  };
  return (
    <div
      className={`app ${viewMode === "simple" ? "simple-app" : ""}`}
      data-theme={viewMode === "simple" ? "simple" : project.visuals.theme}
    >
      {viewMode === "simple" ? (
        <SimpleStudio
          engine={engine}
          playing={playing}
          ready={ready}
          status={status}
          beat={beat}
          onPlay={() => void toggle()}
          onStop={() => {
            audio.stop();
            setPlaying(false);
            seek(audio.position());
          }}
          onSeek={seek}
          onError={notify}
          onDetailed={() => switchView("detailed")}
          onHome={() => void goHome()}
          onExamples={() => setModal("examples")}
          onHelp={() => setModal("help")}
          onNew={() => void switchProject(newSimpleSong())}
          onProjects={() => void openLibrary()}
          onExport={() => setModal("export")}
        />
      ) : (
        <>
          <header className="topbar">
            <a
              className="brand"
              href="#"
              onClick={(e) => e.preventDefault()}
              aria-label="Wave Function Studio"
            >
              <span className="brand-mark">
                <Activity size={25} />
              </span>
              <span>
                Wave Function<small>SONG STUDIO · DETAILED</small>
              </span>
            </a>
            <div className="project-title">
              <input
                aria-label="Project name"
                value={project.name}
                maxLength={100}
                onChange={(e) =>
                  change((p) => {
                    p.name = e.target.value || "Untitled composition";
                  }, "project-name")
                }
              />
              <span className="save-status">
                <i className={status.startsWith("Saved") ? "saved" : ""} />
                {status}
              </span>
            </div>
            <nav className="top-actions">
              <button className="text-button" onClick={() => void goHome()}>
                One equation
              </button>
              <button
                className="text-button view-switch"
                onClick={() => switchView("simple")}
              >
                Simple view
              </button>
              <button
                className="text-button"
                aria-label="Examples"
                onClick={() => setModal("examples")}
              >
                <Music2 size={16} />
                <span>Examples</span>
              </button>
              <button
                className="text-button"
                aria-label="Projects"
                onClick={() => void openLibrary()}
              >
                <FolderOpen size={16} />
                <span>Projects</span>
              </button>
              <button
                className="icon-button"
                aria-label="Help and equation reference"
                onClick={() => setModal("help")}
              >
                <HelpCircle size={19} />
              </button>
              <button className="primary" onClick={() => setModal("export")}>
                <Download size={16} />
                <span>Export</span>
              </button>
            </nav>
          </header>
          {welcome && (
            <section className="welcome">
              <div className="welcome-copy">
                <span className="eyebrow">
                  A LITTLE MATH. A LOT OF POSSIBILITY.
                </span>
                <h1>
                  Write equations.
                  <br />
                  <em>Hear the math.</em>
                </h1>
              </div>
              <div className="welcome-right">
                <p>
                  Turn a repeating function into a rhythm.
                  <br />
                  Layer a melody. Watch your composition take shape.
                </p>
                <button className="primary" onClick={() => void toggle()}>
                  <Play size={16} fill="currentColor" />
                  Play the example
                </button>
                <button
                  className="text-button"
                  onClick={() => setWelcome(false)}
                >
                  Open studio <ChevronRight size={16} />
                </button>
              </div>
              <button
                className="dismiss icon-button"
                aria-label="Dismiss welcome"
                onClick={() => setWelcome(false)}
              >
                <X size={16} />
              </button>
              <div className="welcome-equation" aria-hidden="true">
                f(x) → ♫
              </div>
            </section>
          )}
          <div className="transport">
            <div className="transport-buttons">
              <button
                className="play-button"
                aria-label={playing ? "Pause" : "Play"}
                disabled={!ready}
                onClick={() => void toggle()}
              >
                {playing ? (
                  <Pause size={19} fill="currentColor" />
                ) : (
                  <Play size={19} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Stop"
                onClick={() => {
                  audio.stop();
                  setPlaying(false);
                  setBeat(audio.position());
                }}
              >
                <Square size={16} fill="currentColor" />
              </button>
              <button
                className="icon-button"
                aria-label="Restart"
                onClick={() =>
                  seek(project.loop.enabled ? project.loop.startBeat : 0)
                }
              >
                <RotateCcw size={17} />
              </button>
            </div>
            <div className="position">
              <strong>
                {String(Math.floor(beat / project.beatsPerBar) + 1).padStart(
                  2,
                  "0",
                )}
                <span>:</span>
                {String(Math.floor(beat % project.beatsPerBar) + 1).padStart(
                  2,
                  "0",
                )}
                <span>:</span>
                {String(Math.floor((beat % 1) * 100)).padStart(2, "0")}
              </strong>
              <small>BAR · BEAT · POSITION</small>
            </div>
            <label className="bpm">
              <input
                aria-label="BPM"
                type="number"
                min={30}
                max={300}
                value={project.bpm}
                onChange={(e) =>
                  change((p) => {
                    p.bpm = Math.max(
                      30,
                      Math.min(300, Number(e.target.value) || 30),
                    );
                  }, "bpm")
                }
              />
              <span>BPM</span>
            </label>
            <button
              className={`icon-button ${audio.metronome ? "active" : ""}`}
              aria-label="Metronome"
              aria-pressed={audio.metronome}
              onClick={() => {
                audio.metronome = !audio.metronome;
                setBeat(audio.position());
              }}
            >
              <Radio size={17} />
            </button>
            <div className="transport-loop">
              <button
                className={`icon-button ${project.loop.enabled ? "active" : ""}`}
                aria-label="Loop"
                aria-pressed={project.loop.enabled}
                onClick={() =>
                  change((p) => {
                    p.loop.enabled = !p.loop.enabled;
                  })
                }
              >
                <Repeat2 size={19} />
              </button>
              <label>
                From
                <input
                  aria-label="Loop start beat"
                  type="number"
                  min={0}
                  max={project.loop.endBeat - 1}
                  step={1}
                  value={project.loop.startBeat}
                  onChange={(e) =>
                    change((p) => {
                      p.loop.startBeat = Math.max(
                        0,
                        Math.min(
                          p.loop.endBeat - 1,
                          Math.round(Number(e.target.value)),
                        ),
                      );
                    })
                  }
                />
              </label>
              <label>
                to
                <input
                  aria-label="Loop end beat"
                  type="number"
                  min={project.loop.startBeat + 1}
                  max={project.lengthBeats}
                  step={1}
                  value={project.loop.endBeat}
                  onChange={(e) =>
                    change((p) => {
                      p.loop.endBeat = Math.min(
                        p.lengthBeats,
                        Math.max(
                          p.loop.startBeat + 1,
                          Math.round(Number(e.target.value)),
                        ),
                      );
                    })
                  }
                />
              </label>
              <span className="subtle">beats</span>
            </div>
            <div className="spacer" />
            <div className="history">
              <button
                className="icon-button"
                aria-label="Undo"
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
            </div>
            <button
              className="icon-button"
              aria-label="Visual and project settings"
              onClick={() => setModal("settings")}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <main className="studio">
            <aside className="tracks-panel">
              <div className="tracks-heading">
                <h2>Equation tracks</h2>
                <span className="count">{project.tracks.length}/32</span>
              </div>
              <div className="track-list">
                {project.tracks.map((t, i) => (
                  <div
                    key={t.id}
                    className={`track-card ${t.id === selectedId ? "selected" : ""} ${t.muted || !t.enabled ? "muted" : ""}`}
                    style={{ "--track": t.color } as React.CSSProperties}
                  >
                    <button
                      className="track-select"
                      aria-label={`Select ${t.name}`}
                      onClick={() => select(t.id)}
                    >
                      <span className="track-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="track-info">
                        <strong>{t.name}</strong>
                        <small>
                          {t.instrument} · {t.mapping}
                        </small>
                      </span>
                      <AudioLines size={18} />
                    </button>
                    <div className="track-expression" title={t.expression}>
                      {t.symbol}(x) = {t.expression}
                    </div>
                    <div className="track-controls">
                      <span
                        className={engine.errors[t.id] ? "error-indicator" : ""}
                      >
                        {engine.errors[t.id]
                          ? "Check equation"
                          : `${t.symbol}(x)`}
                      </span>
                      <button
                        className={t.muted ? "lit" : ""}
                        aria-label={`Mute ${t.name}`}
                        aria-pressed={t.muted}
                        onClick={() => track(t.id, { muted: !t.muted })}
                      >
                        M
                      </button>
                      <button
                        className={t.solo ? "solo lit" : ""}
                        aria-label={`Solo ${t.name}`}
                        aria-pressed={t.solo}
                        onClick={() => track(t.id, { solo: !t.solo })}
                      >
                        S
                      </button>
                    </div>
                  </div>
                ))}
                {!project.tracks.length && (
                  <div className="empty-tracks">
                    <Music2 size={28} />
                    <p>
                      A blank canvas.
                      <br />
                      Add an instrument below.
                    </p>
                  </div>
                )}
              </div>
              <div className="add-track">
                <select
                  aria-label="New track instrument"
                  value={addType}
                  onChange={(e) =>
                    setAddType(e.target.value as Track["instrument"])
                  }
                >
                  {[
                    "kick",
                    "bass",
                    "hat",
                    "synth",
                    "snare",
                    "open-hat",
                    "clap",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t === "synth"
                        ? "Lead synth"
                        : t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  disabled={project.tracks.length >= 32}
                  onClick={() => add(addType)}
                >
                  <Plus size={16} />
                  Add track
                </button>
              </div>
              <div className="sidebar-note">
                <span>ONE UNIT = ONE BEAT</span>
                <p>
                  Patterns repeat. Functions combine.
                  <br />
                  Your equations are the score.
                </p>
              </div>
            </aside>
            <div className="graph-area">
              <Graph playing={playing} onSeek={seek} onError={notify} />
              <div className="value-strip">
                <span className="live-dot" />
                <span>{playing ? "PLAYING" : "READY TO PLAY"}</span>
                <div className="spacer" />
                <span>
                  {selected
                    ? `${selected.symbol}(${beat.toFixed(2)}) = ${Number.isFinite(engine.value(selected.id, beat)) ? engine.value(selected.id, beat).toFixed(3) : "undefined"}`
                    : "Select an equation"}
                </span>
              </div>
            </div>
            <Inspector engine={engine} />
          </main>
          <Timeline beat={beat} onSeek={seek} />
          <footer className="app-footer">
            <span>
              <Check size={13} />
              No account. No uploads. Saved locally.
            </span>
            <button onClick={() => setModal("help")}>
              <Keyboard size={13} />
              Space to play · Ctrl Z to undo
            </button>
            <span>Wave Function / v1.0</span>
          </footer>
        </>
      )}
      <input
        type="file"
        accept=".json,.wf.json"
        hidden
        ref={file}
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {toast && (
        <div role="status" className="toast">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "examples" && (
        <Modal
          title="Start with a little inspiration"
          close={() => setModal(null)}
        >
          <p className="modal-description">
            Playable compositions made entirely from equations. Open one and
            make it yours.
          </p>
          <div className="example-list">
            {(viewMode === "simple" ? simpleExampleInfo : exampleInfo).map(
              (e, i) => (
                <button
                  key={e.name}
                  onClick={() =>
                    void switchProject(
                      viewMode === "simple"
                        ? simpleExampleProject(i)
                        : exampleProject(i),
                    )
                  }
                >
                  <div className={`example-art art-${i}`}>
                    <Activity size={70} />
                  </div>
                  <div>
                    <span className="eyebrow">{e.category}</span>
                    <h3>{e.name}</h3>
                    <p>{e.description}</p>
                  </div>
                  <ChevronRight size={20} />
                </button>
              ),
            )}
          </div>
        </Modal>
      )}
      {modal === "library" && (
        <Modal title="Your projects" close={() => setModal(null)}>
          <p className="modal-description">
            Saved in this browser on this device. Export a project file for a
            portable backup.
          </p>
          <div className="library-actions">
            <button
              className="primary"
              onClick={() => void switchProject(newProject())}
            >
              <Plus size={16} />
              New project
            </button>
            <button className="secondary" onClick={() => file.current?.click()}>
              <Upload size={16} />
              Import project
            </button>
            <button
              className="secondary"
              onClick={() =>
                void saveProject(project)
                  .then(() => listProjects())
                  .then(setSaved)
                  .then(() => notify("Project saved."))
                  .catch(() => notify("Save failed. Export a project file."))
              }
            >
              <Save size={16} />
              Save now
            </button>
          </div>
          <div className="project-list">
            {saved.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  void db.projects
                    .get(p.id)
                    .then((data) => {
                      if (data) return switchProject(validateProject(data));
                    })
                    .catch(() => notify("Could not open this saved project."))
                }
              >
                <FolderOpen size={19} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.tracks.length} tracks · {p.bpm} BPM ·{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </small>
                </span>
                {p.id === project.id ? (
                  <span className="pill">OPEN</span>
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "export" && (
        <ExportDialog
          playbackMode={viewMode === "simple" ? "continuous" : "sequenced"}
          close={() => setModal(null)}
          notify={notify}
          pause={pause}
        />
      )}
      {modal === "settings" && (
        <Modal
          title="Make it look and feel like you"
          close={() => setModal(null)}
        >
          <div className="modal-fields">
            <Field label="Graph theme">
              <select
                aria-label="Graph theme"
                value={project.visuals.theme}
                onChange={(e) =>
                  change((p) => {
                    p.visuals.theme = e.target
                      .value as Project["visuals"]["theme"];
                  })
                }
              >
                {[
                  { v: "dark", n: "Dark graph" },
                  { v: "light", n: "Clean white" },
                  { v: "neon", n: "Neon purple" },
                  { v: "blueprint", n: "Blueprint" },
                  { v: "mono", n: "Monochrome" },
                ].map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time signature">
              <select
                value={project.beatsPerBar}
                onChange={(e) =>
                  change((p) => {
                    p.beatsPerBar = Number(e.target.value);
                  })
                }
              >
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}/4
                  </option>
                ))}
              </select>
            </Field>
            <Range
              label="Line width"
              value={project.visuals.lineWidth}
              min={1}
              max={5}
              step={0.25}
              onChange={(v) =>
                change((p) => {
                  p.visuals.lineWidth = v;
                }, "lineWidth")
              }
            />
            <Range
              label="Master volume"
              value={project.master}
              min={0}
              max={1}
              onChange={(v) =>
                change((p) => {
                  p.master = v;
                }, "master")
              }
            />
            <Range
              label="Delay mix"
              value={project.delay}
              min={0}
              max={0.6}
              onChange={(v) =>
                change((p) => {
                  p.delay = v;
                }, "delay")
              }
            />
          </div>
          <div className="settings-checks">
            {(
              [
                { key: "grid", label: "Show grid" },
                { key: "glow", label: "Curve glow" },
                { key: "follow", label: "Follow playhead" },
              ] as const
            ).map((s) => (
              <label className="check" key={s.key}>
                <input
                  type="checkbox"
                  checked={project.visuals[s.key]}
                  onChange={(e) =>
                    change((p) => {
                      p.visuals[s.key] = e.target.checked;
                    })
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Equations are your instruments"
          close={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              One x-unit is one beat. Press Play to hear the starter
              composition. Select a track to edit its equation, musical mapping,
              and instrument.
            </p>
            <h3>A rhythm in one line</h3>
            <code>exp(-8 * (x mod 1))</code>
            <p>
              Repeats a decay every beat. Set Event mode → Trigger → Rising edge
              at 0.8 to turn it into a kick.
            </p>
            <h3>A melody in four numbers</h3>
            <code>sequence(0, 3, 5, 7)</code>
            <p>
              Each number is a semitone offset from the root note. Scale lock
              chooses the nearest allowed note. The sequence changes every beat;
              note interval controls how often it plays.
            </p>
            <h3>Build with named functions</h3>
            <code>piecewise(x mod 4 &lt; 2, K(x), K(2*x))</code>
            <p>
              Reference the function name of another track. Both K and K(x) are
              valid. Definitions may use K(x) = … or just the expression.
              Changing a function name requires updating references.
            </p>
            <h3>Mapping values</h3>
            <p>
              Trigger/gate modes detect crossings at 48 samples per beat. Pitch,
              amplitude, filter, and pan sample at each note interval. Gate
              sustains while the threshold is exceeded, up to four beats.
              Visual-only tracks draw without sounding.
            </p>
            <h3>Helpers</h3>
            <div className="helper-grid">
              <code>pulse(period, width, offset?)</code>
              <code>sequence(values…)</code>
              <code>piecewise(test, value, …, fallback)</code>
              <code>mod(a, b) / a mod b</code>
              <code>frac(x) · floor(x) · ceil(x)</code>
              <code>clamp(value, min, max)</code>
              <code>quantize(value, step)</code>
              <code>scale(v, inMin, inMax, outMin, outMax)</code>
              <code>beat(n) · bar(n)</code>
              <code>noise(seed?) · random(seed?)</code>
            </div>
            <p>
              Trigonometry, hyperbolic functions, exp, ln, log (base 10), abs,
              sqrt, min, max, round, sign, pi, and e are supported. Use
              comparisons and and/or/not; use test ? value : fallback for
              conditionals. Random/noise are deterministic by seed and 1/48-beat
              time step.
            </p>
            <h3>Arrange, save, export</h3>
            <p>
              Sections activate layers across the song. Click the ruler or graph
              to seek. Drag the graph to pan and use +/− to zoom. Projects
              autosave in this browser. WAV renders offline; MIDI exports notes;
              video records the animated graph with audio. Download a project
              JSON backup before clearing browser data.
            </p>
            <p className="hint">
              Space: play/pause · Home: restart · Ctrl/Cmd Z: undo · Ctrl/Cmd
              Shift Z: redo · Ctrl/Cmd S: save. Equation editing has its own
              local undo history.
            </p>
          </div>
        </Modal>
      )}
      <div className="sr-only" aria-live="polite">
        {playing ? "Playing" : "Stopped"}
      </div>
    </div>
  );
}
