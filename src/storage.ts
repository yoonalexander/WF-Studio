import Dexie from "dexie";
import type { Table } from "dexie";
import { validateProject } from "./model";
import type { Project } from "./model";
class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  trash!: Table<Project, string>;
  constructor() {
    super("wave-function-studio");
    this.version(1).stores({ projects: "id,updatedAt,name" });
    this.version(2).stores({
      projects: "id,updatedAt,name",
      trash: "id,updatedAt,name",
    });
  }
}
export const db = new StudioDB();
let saveQueue: Promise<unknown> = Promise.resolve();
export function saveProject(project: Project) {
  const snapshot = structuredClone(project);
  const saved = saveQueue
    .catch(() => {})
    .then(async () => {
      // A delayed autosave must not put a deleted song back in the library.
      if (await db.trash.get(snapshot.id)) return;
      await db.projects.put(snapshot);
      localStorage.setItem("wf-active", snapshot.id);
    });
  saveQueue = saved;
  return saved;
}
export async function loadActive() {
  await saveQueue.catch(() => {});
  const id = localStorage.getItem("wf-active");
  const data = id ? await db.projects.get(id) : undefined;
  return data ? validateProject(data) : undefined;
}
export async function listProjects() {
  await saveQueue.catch(() => {});
  return db.projects.orderBy("updatedAt").reverse().toArray();
}
export async function listTrash() {
  await saveQueue.catch(() => {});
  return db.trash.orderBy("updatedAt").reverse().toArray();
}
export function trashProject(id: string) {
  const pending = saveQueue
    .catch(() => {})
    .then(async () => {
      await db.transaction("rw", db.projects, db.trash, async () => {
        const project = await db.projects.get(id);
        if (!project) throw new Error("Project was not found.");
        await db.trash.put(project);
        await db.projects.delete(id);
      });
      if (localStorage.getItem("wf-active") === id)
        localStorage.removeItem("wf-active");
    });
  saveQueue = pending;
  return pending;
}
export function restoreProject(id: string) {
  const pending = saveQueue
    .catch(() => {})
    .then(() =>
      db.transaction("rw", db.projects, db.trash, async () => {
        const project = await db.trash.get(id);
        if (!project) throw new Error("Project was not found in Trash.");
        await db.projects.put(validateProject(project));
        await db.trash.delete(id);
      }),
    );
  saveQueue = pending;
  return pending;
}
export function parseProjectFile(text: string) {
  if (text.length > 1_000_000)
    throw new Error("Project files must be under 1 MB.");
  return validateProject(JSON.parse(text));
}
export async function shareUrl(project: Project) {
  const stream = new Blob([JSON.stringify(project)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const encoded = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (encoded.length > 24000)
    throw new Error(
      "This project is too large for a link. Export a project file instead.",
    );
  return `${location.origin}${location.pathname}#project=${encoded}`;
}
export async function fromShare(hash: string) {
  if (!hash.startsWith("#project=")) return;
  const data = hash.slice(9);
  if (data.length > 24000 || !/^[A-Za-z0-9_-]+$/.test(data))
    throw new Error("Invalid project link.");
  const bytes = Uint8Array.from(
    atob(data.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 1_000_000) throw new Error("Shared project exceeds 1 MB.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  const project = parseProjectFile(new TextDecoder().decode(all));
  project.id = crypto.randomUUID();
  project.name = `${project.name.slice(0, 85)} (remix)`;
  return project;
}
