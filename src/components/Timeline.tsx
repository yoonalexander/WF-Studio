import { Plus, Trash2 } from "lucide-react";
import { useStudio } from "../store";
import type { Section } from "../model";
import { Modal } from "./Modal";
import { Field } from "./Inspector";
import { useState } from "react";
export function Timeline({
  beat,
  onSeek,
}: {
  beat: number;
  onSeek: (b: number) => void;
}) {
  const { project, change } = useStudio(),
    [selected, setSelected] = useState<string | null>(null),
    section = project.sections.find((s) => s.id === selected);
  const patch = (patch: Partial<Section>) =>
    change((p) => {
      const s = p.sections.find((s) => s.id === selected);
      if (s) Object.assign(s, patch);
    });
  const add = () => {
    const end = Math.max(0, ...project.sections.map((s) => s.endBeat));
    if (end >= project.lengthBeats) return;
    const s: Section = {
      id: crypto.randomUUID(),
      name: "New section",
      startBeat: end,
      endBeat: Math.min(end + project.beatsPerBar * 4, project.lengthBeats),
      activeTrackIds: project.tracks.map((t) => t.id),
    };
    change((p) => p.sections.push(s));
    setSelected(s.id);
  };
  return (
    <section className="timeline">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">ARRANGEMENT</span>
          <span className="subtle"> Click a section to edit its layers</span>
        </div>
        <div className="row">
          <Field label="Length (bars)">
            <input
              aria-label="Project length in bars"
              type="number"
              min={1}
              max={Math.floor(512 / project.beatsPerBar)}
              value={project.lengthBeats / project.beatsPerBar}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                const length = Math.max(
                  project.beatsPerBar,
                  Math.min(512, Math.round(n) * project.beatsPerBar),
                );
                change((p) => {
                  p.lengthBeats = length;
                  p.loop.startBeat = Math.min(
                    p.loop.startBeat,
                    length - project.beatsPerBar,
                  );
                  p.loop.endBeat = Math.min(
                    Math.max(p.loop.startBeat + 1, p.loop.endBeat),
                    length,
                  );
                  p.sections = p.sections
                    .filter((s) => s.startBeat < length)
                    .map((s) => ({
                      ...s,
                      endBeat: Math.min(s.endBeat, length),
                    }));
                });
              }}
            />
          </Field>
          <button
            className="text-button"
            onClick={add}
            disabled={
              project.sections.length >= 32 ||
              Math.max(0, ...project.sections.map((s) => s.endBeat)) >=
                project.lengthBeats
            }
          >
            <Plus size={14} />
            Section
          </button>
        </div>
      </div>
      <div
        className="ruler"
        role="slider"
        aria-label="Song position"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={project.lengthBeats}
        aria-valuenow={Math.round(beat)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight")
            onSeek(Math.min(project.lengthBeats, beat + 1));
          if (e.key === "ArrowLeft") onSeek(Math.max(0, beat - 1));
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * project.lengthBeats);
        }}
      >
        {Array.from(
          {
            length: Math.min(
              17,
              Math.ceil(project.lengthBeats / project.beatsPerBar) + 1,
            ),
          },
          (_, i) => {
            const b =
              (i * project.lengthBeats) /
              Math.min(
                16,
                Math.ceil(project.lengthBeats / project.beatsPerBar),
              );
            return (
              <span
                key={i}
                style={{ left: `${(b / project.lengthBeats) * 100}%` }}
              >
                {Math.floor(b / project.beatsPerBar) + 1}
              </span>
            );
          },
        )}
      </div>
      <div className="section-lane">
        <div
          className="timeline-playhead"
          style={{ left: `${(beat / project.lengthBeats) * 100}%` }}
        />
        {project.sections.map((s, i) => (
          <button
            className={`section-block ${beat >= s.startBeat && beat < s.endBeat ? "current" : ""}`}
            key={s.id}
            style={
              {
                left: `${(s.startBeat / project.lengthBeats) * 100}%`,
                width: `${((s.endBeat - s.startBeat) / project.lengthBeats) * 100}%`,
                "--section": ["#80d8ca", "#e9b478", "#a9a2ef", "#8dc3ed"][
                  i % 4
                ],
              } as React.CSSProperties
            }
            onClick={() => setSelected(s.id)}
          >
            <strong>{s.name}</strong>
            <span>{s.activeTrackIds.length} layers</span>
          </button>
        ))}
        {!project.sections.length && (
          <button className="empty-arrangement" onClick={add}>
            All tracks play throughout. Add a section to build your song.
          </button>
        )}
      </div>
      {section && (
        <Modal title="Edit section" close={() => setSelected(null)}>
          <div className="modal-fields">
            <Field label="Section name">
              <input
                value={section.name}
                maxLength={40}
                onChange={(e) => patch({ name: e.target.value || "Section" })}
              />
            </Field>
            <Field label="Start beat">
              <input
                aria-label="Section start beat"
                type="number"
                min={0}
                max={section.endBeat - 1}
                step={1}
                value={section.startBeat}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (
                    n >= 0 &&
                    n < section.endBeat &&
                    !project.sections.some(
                      (s) =>
                        s.id !== section.id &&
                        n < s.endBeat &&
                        section.endBeat > s.startBeat,
                    )
                  )
                    patch({ startBeat: n });
                }}
              />
            </Field>
            <Field label="End beat">
              <input
                aria-label="Section end beat"
                type="number"
                min={section.startBeat + 1}
                max={project.lengthBeats}
                step={1}
                value={section.endBeat}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (
                    n > section.startBeat &&
                    n <= project.lengthBeats &&
                    !project.sections.some(
                      (s) =>
                        s.id !== section.id &&
                        section.startBeat < s.endBeat &&
                        n > s.startBeat,
                    )
                  )
                    patch({ endBeat: n });
                }}
              />
            </Field>
          </div>
          <h3>Active layers</h3>
          <div className="section-tracks">
            {project.tracks.map((t) => (
              <label className="check" key={t.id}>
                <input
                  type="checkbox"
                  checked={section.activeTrackIds.includes(t.id)}
                  onChange={(e) =>
                    patch({
                      activeTrackIds: e.target.checked
                        ? [...section.activeTrackIds, t.id]
                        : section.activeTrackIds.filter((id) => id !== t.id),
                    })
                  }
                />
                <i className="track-dot" style={{ background: t.color }} />
                {t.name} · {t.symbol}(x)
              </label>
            ))}
          </div>
          <div className="modal-footer">
            <button
              className="text-button danger"
              onClick={() => {
                change((p) => {
                  p.sections = p.sections.filter((s) => s.id !== section.id);
                });
                setSelected(null);
              }}
            >
              <Trash2 size={15} />
              Delete section
            </button>
            <button className="primary" onClick={() => setSelected(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
