import { create } from "zustand";
import type { Project, Track } from "./model";
import { makeTrack, MAX_TRACKS } from "./model";
import { exampleProject, simpleExampleProject } from "./examples";
interface State {
  project: Project;
  selectedId: string;
  past: Project[];
  future: Project[];
  revision: number;
  change: (edit: (p: Project) => void, key?: string) => void;
  load: (p: Project) => void;
  select: (id: string) => void;
  add: (type: Track["instrument"]) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  track: (id: string, patch: Partial<Track>, key?: string) => void;
  undo: () => void;
  redo: () => void;
}
let lastKey = "",
  lastTime = 0;
const initial = (() => {
  try {
    if (localStorage.getItem("wave-function-view") === "detailed")
      return exampleProject();
  } catch {
    /* Browser storage is optional. */
  }
  return simpleExampleProject();
})();
export const useStudio = create<State>((set, get) => ({
  project: initial,
  selectedId: initial.tracks[0].id,
  past: [],
  future: [],
  revision: 0,
  select: (id) => set({ selectedId: id }),
  change: (edit, key) => {
    const state = get(),
      next = structuredClone(state.project);
    edit(next);
    next.updatedAt = new Date().toISOString();
    const now = Date.now(),
      group = key && key === lastKey && now - lastTime < 700;
    lastKey = key ?? "";
    lastTime = now;
    set({
      project: next,
      past: group ? state.past : [...state.past, state.project].slice(-80),
      future: [],
      revision: state.revision + 1,
    });
  },
  load: (p) => {
    lastKey = "";
    set((s) => ({
      project: p,
      selectedId: p.tracks[0]?.id ?? "",
      past: [],
      future: [],
      revision: s.revision + 1,
    }));
  },
  track: (id, patch, key) =>
    get().change((p) => {
      const t = p.tracks.find((t) => t.id === id);
      if (t) Object.assign(t, patch);
    }, key),
  add: (type) => {
    if (get().project.tracks.length >= MAX_TRACKS) return;
    const t = makeTrack(type, get().project.tracks.length);
    const symbol = {
      synth: "M",
      bass: "B",
      kick: "K",
      snare: "S",
      hat: "H",
      "open-hat": "O",
      clap: "C",
    }[type];
    t.symbol = symbol;
    let suffix = 2;
    while (get().project.tracks.some((v) => v.symbol === t.symbol))
      t.symbol = `${symbol}${suffix++}`;
    get().change((p) => {
      p.tracks.push(t);
      p.sections.forEach((s) => s.activeTrackIds.push(t.id));
    });
    set({ selectedId: t.id });
  },
  duplicate: (id) => {
    const old = get().project.tracks.find((t) => t.id === id);
    if (!old || get().project.tracks.length >= MAX_TRACKS) return;
    const t = structuredClone(old);
    t.id = crypto.randomUUID();
    t.name = `${t.name.slice(0, 50)} copy`;
    let i = 2;
    while (
      get().project.tracks.some(
        (v) => v.symbol === `${old.symbol.slice(0, 12)}${i}`,
      )
    )
      i++;
    t.symbol = `${old.symbol.slice(0, 12)}${i}`;
    get().change((p) => {
      p.tracks.push(t);
      p.sections.forEach((s) => {
        if (s.activeTrackIds.includes(id)) s.activeTrackIds.push(t.id);
      });
    });
    set({ selectedId: t.id });
  },
  remove: (id) => {
    get().change((p) => {
      p.tracks = p.tracks.filter((t) => t.id !== id);
      p.sections.forEach(
        (s) => (s.activeTrackIds = s.activeTrackIds.filter((t) => t !== id)),
      );
    });
    set({ selectedId: get().project.tracks[0]?.id ?? "" });
  },
  undo: () => {
    const s = get();
    if (!s.past.length) return;
    lastKey = "";
    const p = s.past.at(-1)!;
    set({
      project: p,
      past: s.past.slice(0, -1),
      future: [s.project, ...s.future],
      revision: s.revision + 1,
      selectedId: p.tracks.some((t) => t.id === s.selectedId)
        ? s.selectedId
        : (p.tracks[0]?.id ?? ""),
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    lastKey = "";
    const p = s.future[0];
    set({
      project: p,
      past: [...s.past, s.project],
      future: s.future.slice(1),
      revision: s.revision + 1,
      selectedId: p.tracks.some((t) => t.id === s.selectedId)
        ? s.selectedId
        : (p.tracks[0]?.id ?? ""),
    });
  },
}));
