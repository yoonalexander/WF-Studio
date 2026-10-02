# Wave Function

**Write equations. Hear the math.** A web-first, local-first math music studio built from the supplied design document and the two reference videos.

## Run

Node.js 22.12+ or 24 LTS is recommended.

```sh
npm install
npm run dev
```

On Windows use `npm.cmd`. Open the URL Vite prints. No environment variables, account, backend, API keys, sample downloads, or paid services are required.

```sh
npm test                 # equation, mapping, project validation and MIDI tests
npm run build            # strict TypeScript + production build
npx playwright install chromium
npm run dev              # keep this running in a separate terminal
npm run test:browser     # complete browser workflows and audio/video exports
npm audit
```

To test a deployed build, set `WF_BASE_URL` to its origin before running browser tests. These tests use an isolated browser profile and do not modify your personal saved projects.

## Create a composition

1. Press Play on the starter composition, or open Projects → New project.
2. Add a Kick and enter `exp(-8 * (x mod 1))`. Event → Trigger detects the rising edge at 0.8.
3. Add a Bass with `sequence(0, 0, -4, -2)`, mapped to pitch.
4. Add a Lead and reference `B(x + 1) + 7`.
5. Set BPM, root note, scale and note interval. Each x-unit is one beat.
6. Click arrangement sections to choose their active tracks. Gaps between sections play all enabled tracks.
7. Export the loop or whole song as WAV, MIDI, video, or a portable project file. Remix links embed a compressed project in the URL fragment and create a new local copy when opened.

Local projects autosave to IndexedDB in this browser on this origin. **Project JSON files are the portable backup.** Clearing site data removes local projects. Local development and the deployed site have separate libraries.

## Implemented

- Multiple equation tracks (up to 32), CodeMirror highlighting/completion/bracket matching, KaTeX notation and inline errors.
- Restricted math AST interpreter; arithmetic, comparisons, logic, modulo, functions, lazy piecewise/conditional branches, deterministic seeded noise, named functions and transformations.
- Pitch, trigger, gate, amplitude, filter, pan and visual mappings. Five scale locks, root note, note interval and length.
- Synth/bass with sine, triangle, saw and square oscillators; ADSR, cutoff, detune, pan and volume. Synthesized kick, snare, closed/open hat and clap. Master compressor and delay.
- Audio-clock transport with look-ahead scheduling; play/pause/stop/restart, tempo, metronome and loop range. Visuals follow audio and cannot change its timing.
- Worker-sampled high-DPI Canvas graphs, pan, zoom, reset, fullscreen, moving points, combined curve, follow mode, glow and five themes.
- Sections and per-section activation, three example songs, local project library, autosave, JSON import/export and grouped undo/redo.
- Stereo PCM WAV through OfflineAudioContext, standard MIDI with tempo and GM drum notes, and 1080p / portrait / square real-time graph video with audio through MediaRecorder.
- Responsive mobile editing, semantic controls, keyboard focus, reduced-motion rendering and keyboard shortcuts.

## Architecture

`src/math.ts` parses with mathjs but **does not call mathjs compile/evaluate**. Only supported numeric/boolean AST nodes are interpreted through our allowlist. Property access, strings, assignments, arrays, object construction, arbitrary function calls and JavaScript execution are rejected.

`src/music.ts` maps the values to musical events. Both the live audio scheduler and exports use it. The same equation can drive pitch, thresholds, gain, cutoff, pan, or only graphics. The project model contains no Web Audio or library-specific objects.

`src/audio.ts` schedules timestamps against AudioContext.currentTime on a 25 ms timer with a 120 ms horizon. Scheduling skips missed windows after suspension rather than bursting overdue notes. Edits re-anchor future scheduling and stop old voices. Native Web Audio is used instead of Tone.js to share the exact voice implementation with offline rendering and keep the dependency footprint smaller.

`src/graph.worker.ts` samples bounded expressions away from the UI thread. `src/graph-render.ts` renders both studio and exported video. `src/storage.ts` serializes IndexedDB saves and validates imports with Zod. `src/store.ts` keeps persistent data separate from transport and undo history.

## Practical bounds

- Expression: 1,024 characters, 256 AST nodes, 32 syntax levels, 16 named-function levels, 2,048 evaluation operations per sample. Cycles and invalid dependencies silence affected tracks.
- Sequencer: crossings sampled at 48 samples per beat. Narrower pulses can be missed. Pitch/amplitude/filter/pan are sampled at note onset; they are not continuous audio-rate modulation. Gates hold up to four beats.
- Playback: maximum 256 simultaneous voices. Extreme event density may drop voices. Normal 32-track arrangements are supported; this is not an unlimited DAW.
- Graph: resolution-aware sampling, maximum 1,800 points per track, 5-second worker timeout, discontinuity gaps and undefined-value suppression.
- Import: 1 MB, 32 tracks / sections, finite bounded settings, unique names/IDs and non-overlapping sections. Share links: 24,000 encoded characters and 1 MB decoded limit.
- WAV/video export: up to 3 minutes per range and 16,000 events, with 3 seconds of release/effect tail. WAV is deterministic and offline. Video is real-time and should stay in a visible tab; its browser-supported format is usually WebM in Chromium. MIDI carries notes, velocity and timing, not synth/effect settings.
- Browser audio starts only after a user gesture. Chromium is the verified browser. Firefox/Safari have standards-based fallback behavior but are not yet part of the automated compatibility suite.

## Deferred design phases

The supplied document explicitly marks direct audio-rate Signal Mode/AudioWorklet synthesis, camera keyframes, samples, accounts/cloud storage, a public gallery, collaboration, advanced DSP and plugin systems as later work. These are not implemented. Local remix URLs and project files provide sharing without a backend. MP3/MP4 encoding is not forced; video uses the format supported by MediaRecorder.

## Deployment

Import this GitHub repository into Vercel with framework **Vite**, build command `npm run build`, and output directory `dist`. `vercel.json` supplies basic response headers. No secrets or environment variables are needed. The shipped frontend never uploads music or project data.

The original videos remain in the workspace, and the design document is included in the repository as reference material. Neither is included in the deployed public directory.

## Source documentation

- [mathjs expression ASTs](https://mathjs.org/docs/expressions/expression_trees.html) and [security guidance](https://mathjs.org/docs/expressions/security.html)
- [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
