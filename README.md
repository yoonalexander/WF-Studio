# Wave Function

**Write equations. Hear the math.** A web-first, local-first math music studio built from the supplied design document and the two reference videos.

[Open the live studio](https://wfstudio.alexyoon.com) · [Verified CI run](https://github.com/yoonalexander/WF-Studio/actions/runs/36974021195)

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

The main page is **one graph, one equation, one sustained sound** on white. Click the equation to edit it, then press Enter or Play. The equation controls the pitch of a continuous synth without scale quantization or repeated note triggers: `y = 0` is C4 (C3 for Deep electro and Warm bass) and an increase of 12 raises the pitch one octave. The moving dot follows the same AudioContext clock. The whole graph stays in one frame, with no zoom controls. Your equation is remembered independently from saved songs.

The **sound wheel** beside Random cycles through Electro lead (default), Deep electro (one octave lower), Pulse lead, Warm bass, 303 Acid bass, Glass, Soft keys and Pure sine. Click the wheel's top edge for the previous sound, click its face for the next, or use a mouse wheel/arrow keys. The expand button opens a compact list for direct selection. **303 Acid bass** is a TB-303-inspired deep saw with high filter resonance, saturation, a short filter decay and pitch glide. Pitch jumps and returns from equation-defined rests reopen its filter; smooth curves stay continuous. It is a character preset rather than a circuit-accurate hardware emulation. The horizontal volume slider beside it adjusts the continuous sound; clicking its speaker icon mutes and restores the previous volume while playback continues. Volume and mute are remembered alongside the sound choice. Switching sounds changes the existing voice's harmonics/filter/saturation without restarting playback or editing the equation. Reduced-motion preferences disable the rolling and expansion animations.

Click the equation, then **Add bounds** to edit branches as expression/condition rows. The first matching condition wins; an optional **otherwise** row handles the remainder. Delete otherwise for silent gaps. Enter finishes editing and displays the equation with a mathematical brace, like the reference videos. Light/dark controls are at the bottom right.

**Random** explores 57 families: the original 32 parameterized patterns plus all 25 equations supplied in the screenshot folder. They cover harmonic blends, nested sine/triangle modulation, chirps, rational and hyperbolic contours, exponential envelopes, quantized steps, pulses, piecewise switches, and bounded rests. A shuffled rotation visits every category before repeating, and each category visits every family before reusing one. Reference formulas also get time-shifted/stretched variations. The negative-only note snippet is translated into a repeating positive-time window for Random. Equations stay editable; undefined values create silence, and existing pitch limits apply near poles. See [the verified screenshot formulas](docs/screenshot-equations.md) for all 25 transcriptions.

`triangle(t)` abbreviates `4 * abs(t - floor(t + 3/4) + 1/4) - 1`; `arctan(t)` aliases `atan(t)`. Explicit numeric bounds automatically expand the homepage frame beyond [-4, 4], up to [-64, 64]. Extreme asymptote tails are clipped to the vertical view. The homepage keeps the equation intact and silences values outside the selected Y range.

The homepage's **X and Y scale knobs** set symmetric ranges: X = 8 means [-8, 8], Y = 3 means [-3, 3]. X uses an arc indicator and Y uses a dot indicator, both in monochrome. Scroll up to turn clockwise/increase; down turns counterclockwise/decreases to zero. Press anywhere on the dial and swipe up/right to increase or down/left to decrease. Swipes continue outside the dial. Tap/click the number to type any finite nonnegative value; arrow keys also work. There is no preset upper scale limit. The defaults are X = 4 (numeric bounds can expand it until manually overridden) and Y = 5; custom values persist across equations and reloads. X also sets the playback loop: the dot and continuous sound traverse the full selected range before wrapping from right to left, at the same tempo. Changing X during playback keeps the existing voice and current position when it fits. Y sets the audible vertical range: sound fades out when the dot leaves [-Y, Y] and resumes when it returns, while the clock keeps moving. Try `tan(x^2 / 3)` at X = 8, Y = 3. When either scale is zero, the graph shows axes without a curve and sound is silent.

**Reveal** draws the equation from left to right during its first pass and keeps the completed line on later loops. Enabling Reveal or changing the equation/X range starts from the left edge; Random does the same while playback continues. Pause preserves the partially revealed line. Turning Reveal off shows the whole curve. The horizontal **speed slider** controls playback from 0.25x to 4x, keeping the dot and continuous sound on the same clock without restarting the voice. Reveal and speed settings persist across reloads.

The text editor accepts interval restrictions such as `4 * sin(x) { -2 <= x < 2 }`, the existing `piecewise(condition, value, ..., otherwiseValue)`, or readable cases:

```text
{
  3 * (1 - 2 * floor(2 * (6 * x mod 1))) if x mod 2 < 0.5;
  -1.2 if x mod 2 < 1.2;
  2.2 * 2 * (2 * x - floor(2 * x + 0.5)) otherwise
}
```

Use semicolons or newlines between cases. Chained bounds (`0 <= x < 2`), `and`/`or`, modulo and equality (`==`) work in conditions. Without otherwise, undefined regions draw no curve or dot and fade to silence; `y = 0` still plays C4. Graphs split at branch changes, and both graph sampling and audio use the same restricted evaluator. These text forms also work in Song studio and exports.

**Song studio** at `/studio` contains both the **Simple view** and **Detailed view**. Simple layers continuous equation-controlled sounds with add/remove, instruments, mappings, mute/solo, saving and exports. Its graph fits every layer and the full loop; each sounding curve has one moving point on the audio clock. Pitch follows the actual value without an automatic note interval or scale lock. Use `sequence`, `floor`, or `quantize` for steps, and bounds for rests. Drum hits follow equation threshold crossings. Detailed adds the arrangement, instrument and visual editors without changing playback. Its moving points use actual sounding values rather than interpolated graph samples; muted, visual-only and silent tracks have no sound point. Both edit the same song, playback continues when switching views, and the studio view choice is remembered. Existing arrangements and project libraries are preserved when moving between the studio and the one-equation page.

1. Open Song studio, then press Play on the starter composition or create a new song/project.
2. Add a Kick and enter `exp(-8 * (x mod 1))`. Event → Trigger detects the rising edge at 0.8.
3. Add a Bass with `sequence(0, 0, -4, -2)`, mapped to pitch.
4. Add a Lead and reference `B(x + 1) + 7`.
5. Set BPM and root note. Each x-unit is one beat. Both views follow continuous math. Event mode offers equation crossings, note lengths and optional scale locks for event-driven pitch.
6. Click arrangement sections to choose their active tracks. Gaps between sections play all enabled tracks.
7. Export the loop or whole song as WAV, MIDI, video, or a portable project file. Both Studio views export WAV/video with the same continuous sound; MIDI converts curves to discrete notes. Remix links embed a compressed project in the URL fragment and create a new local copy when opened.

Simple Studio keeps Tone alongside the other sound controls and fits its graph and editor into a desktop frame. Larger libraries of sound layers and long equations use bounded panels; mobile and very short windows retain accessible scrolling. Both studio views use the homepage's black/white light and dark modes, defaulting to light and remembering your choice across pages. Detailed Studio keeps its arrangement workspace and puts the Simple view switch at the far right.

Local projects autosave to IndexedDB in this browser on this origin. Projects offers **Delete** for each saved song; deleted songs go to **Trash** and can be restored there. Deleting the open song creates a fresh working song, and delayed autosaves cannot recreate the deleted entry. Existing saved projects survive the storage upgrade. **Project JSON files are the portable backup.** Clearing site data removes local projects, including Trash. Local development and the deployed site have separate libraries.

## Implemented

- Multiple equation tracks (up to 32), CodeMirror highlighting/completion/bracket matching, KaTeX notation and inline errors.
- Restricted math AST interpreter; arithmetic, comparisons, logic, modulo, functions, lazy piecewise/conditional branches, deterministic seeded noise, named functions and transformations.
- Continuous pitch, amplitude, filter and pan controls in both Studio views; equation-driven trigger/gate events. Detailed exposes event crossings, lengths and scale locks for event-driven pitch. Visual-only mappings and root notes are available in both.
- Synth/bass with sine, triangle, saw and square oscillators; ADSR, cutoff, detune, pan and volume. Synthesized kick, snare, closed/open hat and clap. Master compressor and delay.
- Audio-clock transport with look-ahead scheduling; play/pause/stop/restart, tempo, metronome and loop range. Visuals follow audio and cannot change its timing.
- Worker-sampled high-DPI Canvas graphs, pan, zoom, reset, fullscreen, moving points, combined curve, follow mode, glow and shared light/dark appearance.
- Sections and per-section activation, three example songs, local project library, autosave, JSON import/export and grouped undo/redo.
- Stereo PCM WAV through OfflineAudioContext, standard MIDI with tempo and GM drum notes, and 1080p / portrait / square real-time graph video with audio through MediaRecorder.
- Responsive mobile editing, semantic controls, keyboard focus, reduced-motion rendering and keyboard shortcuts.

## Architecture

`src/math.ts` parses with mathjs but **does not call mathjs compile/evaluate**. Only supported numeric/boolean AST nodes are interpreted through our allowlist. Property access, strings, assignments, arrays, object construction, arbitrary function calls and JavaScript execution are rejected.

`src/music.ts` maps the values to musical events. Both the live audio scheduler and exports use it. The same equation can drive pitch, thresholds, gain, cutoff, pan, or only graphics. The project model contains no Web Audio or library-specific objects.

`src/audio.ts` uses the same sustained voices in both Studio views. It evaluates continuous controls every 16 ms against AudioContext.currentTime; edits, mute and solo retune or fade existing voices. `src/sustained-voice.ts` shares that voice implementation with offline WAV/video rendering. Equation-driven events use a 120 ms scheduling horizon. Both Studio views run the scheduler every 16 ms; the optional metronome is independent of equation playback. Scheduling skips missed windows after suspension rather than bursting overdue notes. Native Web Audio keeps the dependency footprint smaller.

`src/continuous-audio.ts` powers the main page with one sustained oscillator. It evaluates the equation every 16 ms, smoothly changes frequency, and keeps the graph point on the same audio clock. Invalid or undefined values fade to silence. Changing the equation retunes the existing oscillator rather than scheduling new notes. Pitch offsets are bounded to four octaves in either direction.

`src/graph.worker.ts` samples bounded expressions away from the UI thread. `src/graph-render.ts` renders both studio and exported video. `src/storage.ts` serializes IndexedDB saves and validates imports with Zod. `src/store.ts` keeps persistent data separate from transport and undo history.

## Practical bounds

- Expression: 1,024 characters, 256 AST nodes, 32 syntax levels, 16 named-function levels, 2,048 evaluation operations per sample. Cycles and invalid dependencies silence affected tracks.
- Studio continuous controls update every 16 ms live and 10 ms offline, with short parameter smoothing; they are not audio-rate waveform synthesis. Event crossings are sampled at 48 samples per beat, so narrower pulses can be missed. Gates hold up to four beats.
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
