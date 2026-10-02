# Web-Based Math Music Studio

## Product & Technical Design Document

**Status:** Draft v0.1  
**Platform:** Web  
**Primary goal:** Let anyone compose music and synchronized mathematical animation in a browser by writing equations.

---

## 1. Executive Summary

This project is a browser-based creative tool that combines a graphing calculator, step sequencer, synthesizer, and animation editor.

The reference videos use mathematical functions as the visual and structural basis of music. Repeating expressions such as `x mod n`, piecewise functions, decays, trigonometric functions, and translated functions are layered to represent musical parts such as kicks, bass, hats, leads, and rolls. Multiple named functions can then be combined into a complete track.

The web version should preserve that core idea while making it much easier to create interactively:

1. A user writes or edits an equation.
2. The graph updates immediately.
3. The equation is assigned to a musical role such as pitch, rhythm, amplitude, filter, or a complete instrument track.
4. Pressing Play moves a synchronized playhead across the graph.
5. The browser generates the music in real time with the Web Audio API.
6. Multiple equation tracks can be layered into a song.
7. The user can export the result as audio, MIDI, or a shareable animated video.

The experience should feel roughly like **Desmos + Ableton/FL Studio + a lightweight motion graphics tool**, but designed specifically around equations instead of a traditional piano roll.

---

## 2. Product Vision

### 2.1 Vision Statement

Create the easiest way to turn mathematics into music and animated visual art directly in a web browser.

A user should be able to open the site, type a function such as:

```text
sin(2*pi*x)
```

or:

```text
exp(-8 * (x mod 1))
```

and immediately hear and see what that function does.

The project should support two overlapping audiences:

- **Casual creators** who want to experiment with interesting equations and sounds.
- **Technical creators** who want precise control over rhythmic, melodic, and synthesis behavior.

The product should not require users to understand digital signal processing before they can make something interesting.

---

## 3. Reference Video Observations

The uploaded reference videos establish several important interaction and rendering patterns that the web app should support.

### 3.1 Equations are the primary creative object

The visual content is centered around mathematical expressions rather than a normal DAW timeline.

Examples visible in the references include:

- trigonometric functions
- exponential decays
- `x mod n`
- piecewise expressions
- floor/fractional-part style operations
- translated functions such as `L(x + 1)`
- sums of named functions such as `K + B + H + C + L`

### 3.2 Repetition is created mathematically

Modulo operations are heavily used to create repeating structures. This maps naturally to beats and bars.

For example:

```text
d = x mod 1
```

can represent a one-beat repeating phase.

### 3.3 Music is built in layers

The reference video progressively introduces layers such as:

- kick
- bass
- hats
- lead
- snare roll

The final expression visually combines multiple functions into one composition.

### 3.4 Animation is synchronized with musical progression

The graph is not just a static chart. The visual state develops with the song, and the viewer can see changes corresponding to drops, builds, half-time sections, and added layers.

### 3.5 Functions need to be reusable and transformable

A user should be able to define:

```text
K(x) = ...
L(x) = ...
```

and later write:

```text
K(x) + L(x + 1)
```

without duplicating the original expressions.

---

## 4. Core Product Concept

The basic unit of the application is a **Math Track**.

A Math Track consists of:

- a mathematical expression
- a graph
- a musical interpretation
- an instrument or synthesizer
- visual styling
- timing and loop settings

Each track evaluates its expression as the global playhead moves through time.

Conceptually:

```text
x = musical time
f(x) = control signal
```

The output of `f(x)` can control one or more musical parameters.

Examples:

```text
f(x) -> pitch
f(x) -> note trigger
f(x) -> amplitude
f(x) -> filter cutoff
f(x) -> panning
f(x) -> effect intensity
```

The same mathematical data also drives the graph animation.

---

## 5. Product Modes

The application should eventually support three equation modes. Only the first two are required for the first public version.

### 5.1 Control Mode

The equation generates a continuous control value.

Example:

```text
f(x) = sin(2*pi*x)
```

Possible mappings:

- oscillator pitch
- volume
- filter cutoff
- stereo pan
- distortion amount
- animation position

This is the easiest mode to understand and visualize.

### 5.2 Event / Sequencer Mode

The equation is interpreted as musical events rather than raw audio.

Examples:

```text
floor(4*x) mod 4
```

or piecewise logic such as:

```text
if (x mod 1) < 0.1 then 1 else 0
```

The result can generate:

- kick hits
- hi-hats
- MIDI notes
- chords
- gates
- accents

This mode makes it possible to create songs using normal instruments while still defining the arrangement mathematically.

### 5.3 Signal Mode - Advanced / Later

The equation directly generates a normalized waveform.

```text
y = f(t)
```

The function is sampled at audio rate and converted into PCM audio through an `AudioWorklet`.

This allows true mathematical sound synthesis but introduces more difficult issues involving aliasing, discontinuities, CPU usage, and safe amplitude limits.

This should be treated as an advanced feature rather than the primary MVP workflow.

---

## 6. Primary User Experience

### 6.1 Landing Experience

The homepage should immediately provide a playable example.

The user sees:

- animated graph
- equation
- Play button
- a short explanation: **"Write equations. Hear the math."**
- **Open Studio** button

No account should be required to experiment.

### 6.2 Studio Layout

Desktop layout:

```text
+---------------------------------------------------------------------+
| Logo | Project Name                  BPM 120 | Play | Save | Export |
+----------------------+----------------------------------------------+
|                      |                                              |
| Tracks / Equations   |                Graph Canvas                  |
|                      |                                              |
| + Kick               |                 y                            |
| + Bass               |                 |                            |
| + Hats               |        ---------|-------- x                  |
| + Lead               |                 |                            |
|                      |                                              |
+----------------------+----------------------------------------------+
| Inspector / Instrument / Mapping / Effects                          |
+---------------------------------------------------------------------+
| Timeline / Sections / Loop                                          |
+---------------------------------------------------------------------+
```

Mobile should prioritize playback and editing one selected track at a time rather than trying to reproduce the full desktop DAW layout.

---

## 7. Main Editor Areas

### 7.1 Equation Panel

Each track row contains:

- color
- track name
- equation input
- mute
- solo
- enable/disable
- instrument icon
- error indicator
- collapse/expand button

Example:

```text
Kick
K(x) = exp(-8 * (x mod 1))
```

Equation editing should support:

- syntax highlighting
- autocomplete
- inline error messages
- function documentation tooltips
- bracket matching
- keyboard shortcuts
- duplicate track
- rename variable/function

Rendered math can be displayed underneath or beside the editable text using KaTeX.

### 7.2 Graph Canvas

The graph should support:

- pan
- zoom
- reset view
- configurable grid
- axes
- labels
- playhead
- function trail
- highlighted current point
- multiple track overlays
- per-track colors
- optional glow / neon visual mode
- optional dark and light themes

The graph should be renderable independently from the audio engine so visual frame rate does not control audio timing.

### 7.3 Transport

Global controls:

- Play
- Pause
- Stop
- Restart
- BPM
- time signature
- metronome
- loop on/off
- loop range
- current beat/bar

Recommended internal time representation:

```text
1 x-unit = 1 beat
```

At 120 BPM:

```text
1 beat = 0.5 seconds
```

This makes expressions such as `x mod 4` naturally correspond to a four-beat bar.

Users can optionally switch the x-axis display between:

- beats
- bars
- seconds

Internally, beats should remain the canonical unit.

---

## 8. Musical Mapping System

The mapping layer is what turns arbitrary mathematical functions into useful musical behavior.

### 8.1 Mapping Types

Each track can map function output to one or more destinations.

#### Pitch

```text
f(x) -> MIDI note
```

Example mapping:

```text
y = 0     -> C4

y = 1     -> D4

y = 2     -> E4
```

A Scale Lock option quantizes values to a musical scale.

Supported scales should initially include:

- Chromatic
- Major
- Minor
- Harmonic Minor
- Pentatonic

Later, custom scales can be added.

#### Trigger

Generate an event when the value crosses a threshold.

```text
trigger when f(x) > 0.8
```

Optional modes:

- rising-edge crossing
- falling-edge crossing
- either direction
- region entered
- integer transition

#### Gate

A note remains active while a mathematical condition is true.

```text
(x mod 1) < 0.25
```

#### Velocity

Map function output into MIDI-style velocity.

```text
-1...1 -> 0...127
```

#### Amplitude

Map output to gain.

#### Filter Cutoff

Map normalized function values logarithmically into a frequency range.

Example:

```text
-1...1 -> 100 Hz...12 kHz
```

#### Pan

```text
-1 -> left
0  -> center
1  -> right
```

#### Effect Parameters

Later mappings can include:

- reverb wetness
- delay feedback
- distortion
- chorus depth
- compressor threshold

---

## 9. Instrument System

### 9.1 MVP Instruments

Provide simple built-in instruments so a user can start immediately.

#### Drum Kit

- Kick
- Snare
- Closed Hat
- Open Hat
- Clap

#### Synth

Oscillators:

- sine
- triangle
- saw
- square

Parameters:

- attack
- decay
- sustain
- release
- octave
- detune
- filter

#### Bass Synth

A simplified monophonic synth optimized for bass lines.

### 9.2 Sample Playback

Users should later be able to upload audio samples.

Supported initial formats:

- WAV
- MP3
- OGG

Uploaded samples remain local unless the user explicitly saves them to a cloud project.

### 9.3 Presets

Useful presets:

- Techno Kick
- Hard Kick
- Sub Bass
- Acid Bass
- Pluck
- Screech Lead
- Soft Pad
- Closed Hat
- Snare Roll

Presets make the system accessible to users who understand equations but not synthesizer design.

---

## 10. Equation Language

The equation language should resemble common graphing-calculator syntax while remaining safe to evaluate in the browser.

### 10.1 Required Operators

```text
+ - * / ^
< <= > >= == !=
and or not
```

### 10.2 Required Functions

```text
sin cos tan
asin acos atan
sinh cosh tanh
abs
sqrt
exp
ln log
floor ceil round
min max
sign
clamp
mod
frac
```

Constants:

```text
pi
e
```

### 10.3 Musical Helper Functions

Add domain-specific helpers on top of normal math.

```text
beat(n)
bar(n)
pulse(period, width)
step(values...)
sequence(values...)
noise(seed?)
random(seed?)
quantize(value, step)
scale(value, fromMin, fromMax, toMin, toMax)
```

Examples:

```text
pulse(1, 0.1)
```

creates a short pulse every beat.

```text
sequence(0, 3, 5, 7)
```

returns a repeating sequence across beats.

These helpers are optional conveniences. Everything they do should remain expressible using standard math.

### 10.4 Named Functions

Support:

```text
K(x) = ...
B(x) = ...
L(x) = ...
```

and references:

```text
K(x) + B(x) + L(x + 1)
```

### 10.5 Piecewise Expressions

Both visual and text syntax should be supported.

Text version:

```text
piecewise(
  x < 1, expressionA,
  x < 2, expressionB,
  expressionC
)
```

A more user-friendly conditional editor can later render this as mathematical piecewise notation.

---

## 11. Expression Evaluation Engine

### 11.1 Safety Requirement

Do **not** execute arbitrary user input with JavaScript `eval()` or `new Function()`.

Expressions should be parsed into an Abstract Syntax Tree using a restricted grammar.

Only allowlisted:

- operators
- functions
- constants
- project-defined named functions

should be executable.

### 11.2 Evaluation Pipeline

```text
User equation
    ↓
Tokenizer
    ↓
Parser
    ↓
AST
    ↓
Semantic validation
    ↓
Dependency resolution
    ↓
Compiled safe evaluator
    ↓
Graph samples / music control values
```

### 11.3 Dependency Graph

Named functions can reference other functions.

Example:

```text
A(x) = sin(x)
B(x) = A(x) * 2
C(x) = B(x) + A(x + 1)
```

The application should build a dependency graph and detect cycles.

Invalid example:

```text
A(x) = B(x)
B(x) = A(x)
```

The UI should return a clear circular-dependency error instead of freezing.

### 11.4 Suggested Libraries

Potential parser/evaluator approaches:

- `mathjs`, using its parser and compiled expressions with a restricted environment
- a custom parser using `chevrotain`
- a custom small expression grammar if maximum control becomes necessary

For the MVP, `mathjs` is likely the fastest path, but direct access to unsafe or unnecessary functions should be restricted.

---

## 12. Audio Architecture

### 12.1 Core Technology

Use the **Web Audio API** as the underlying audio platform.

Tone.js can be used initially as a higher-level layer for:

- transport
- synths
- envelopes
- scheduling
- effects

The architecture should avoid becoming permanently dependent on Tone.js-specific project data so lower-level Web Audio components can replace it later.

### 12.2 Audio Timing

Audio scheduling must never depend on `requestAnimationFrame()`.

The audio engine should schedule slightly ahead of playback time.

Recommended approach:

```text
Web Audio clock = source of truth
UI clock = visual follower
```

The renderer reads the current musical position from the audio transport and displays the corresponding graph position.

### 12.3 Look-Ahead Scheduling

For event-based tracks:

- scheduler wakes approximately every 25 ms
- schedules events roughly 100 to 150 ms ahead
- event timestamps use `AudioContext.currentTime`

This reduces audible jitter caused by the browser's main thread.

### 12.4 AudioWorklet

Use `AudioWorklet` later for:

- signal-mode equations
- custom oscillators
- high-frequency parameter generation
- advanced DSP

Never perform real-time DSP in the main UI thread.

---

## 13. Graph Rendering Architecture

### 13.1 MVP Renderer

Use HTML Canvas 2D for the main graph.

Reasons:

- easier than WebGL
- sufficient for dozens of curves
- supports high-DPI rendering
- straightforward animation

SVG is useful for equation labels and UI elements but should not be the primary renderer for thousands of continuously moving samples.

### 13.2 Future Renderer

If projects grow to hundreds of thousands of points or heavy effects, migrate curve rendering to WebGL/WebGPU.

Potential options:

- custom WebGL renderer
- PixiJS
- regl
- WebGPU later

### 13.3 Sampling

The graph should use adaptive or resolution-aware sampling.

The renderer does not need to evaluate one point for every theoretical time value.

Example:

```text
visible width = 1200 px
sample approximately 1200 to 2400 x-values
```

Discontinuities should be detected so the graph does not incorrectly connect across vertical asymptotes.

---

## 14. Animation System

The app should make it easy to produce visuals resembling the reference videos without requiring a separate video editor.

### 14.1 Playhead Animation

At minimum:

- selected point travels along the function
- completed segment can become brighter
- future segment can be dimmer
- graph can smoothly pan with the playhead

### 14.2 Visual Build-Up

Tracks can have timeline visibility states.

Example:

```text
Bars 1-4: Kick
Bars 5-8: Kick + Bass
Bars 9-12: Kick + Bass + Hats
Bars 13-16: Full track
```

The graph then visually builds as the song builds.

### 14.3 Visual Themes

Presets:

- Clean White
- Dark Graph
- Neon Purple
- Blueprint
- Minimal Monochrome

Visual parameters:

- line width
- line glow
- grid opacity
- axis opacity
- background
- label visibility
- equation visibility
- trail length
- playhead size

### 14.4 Camera Automation - Later

Allow keyframes for:

- graph center
- zoom
- rotation for non-standard visual modes
- label positions

This turns the app into a lightweight math-based music visualizer.

---

## 15. Song Arrangement

### 15.1 Sections

A project can contain named sections:

- Intro
- Build
- Drop
- Breakdown
- Drop 2
- Outro

A section contains:

- start bar
- end bar
- active tracks
- per-track overrides
- camera / visual settings

### 15.2 Track Activation

Instead of requiring equations to contain every arrangement decision, a user can activate or deactivate tracks by section.

Advanced users can still encode arrangement logic mathematically.

### 15.3 Function Transformations

Provide quick transformations:

```text
f(x + a)   time shift
f(b*x)     time scale
c*f(x)     vertical scale
f(x) + d   vertical shift
-f(x)      inversion
```

The UI can offer sliders that automatically modify these parameters while preserving the equation structure.

---

## 16. Example Project

A starter project can recreate the conceptual structure seen in the reference videos.

### Kick

```text
phase = x mod 1
K(x) = exp(-8 * phase)
```

Mapping:

```text
K -> kick trigger / pitch envelope
```

### Bass

```text
stepIndex = floor(x * 2) mod 4
B(x) = sequence(0, 0, -4, -2)
```

Mapping:

```text
B -> bass pitch
```

### Hi-Hat

```text
H(x) = pulse(0.5, 0.08)
```

Mapping:

```text
H -> closed hat trigger
```

### Lead

```text
L(x) = 3 + sequence(0, 3, 0, -2, 0, 5, 3)
```

Mapping:

```text
L -> synth pitch
```

### Combined Visual Function

```text
Y(x) = K(x) + B(x) + H(x) + L(x + 1)
```

The music engine can continue to treat the layers separately while the renderer optionally displays the combined function.

---

## 17. Project Data Model

Suggested TypeScript model:

```ts
interface Project {
  id: string;
  version: number;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  loop: {
    enabled: boolean;
    startBeat: number;
    endBeat: number;
  };
  tracks: MathTrack[];
  sections: Section[];
  visualSettings: VisualSettings;
  createdAt: string;
  updatedAt: string;
}

interface MathTrack {
  id: string;
  name: string;
  symbol?: string;
  expression: string;
  mode: "control" | "event" | "signal";
  enabled: boolean;
  muted: boolean;
  solo: boolean;
  color: string;
  instrument: InstrumentConfig;
  mappings: ParameterMapping[];
  visual: TrackVisualSettings;
}

interface ParameterMapping {
  source: "value" | "derivative" | "crossing" | "condition";
  destination: string;
  inputRange?: [number, number];
  outputRange?: [number, number];
  quantize?: QuantizeConfig;
}

interface Section {
  id: string;
  name: string;
  startBeat: number;
  endBeat: number;
  activeTrackIds: string[];
}
```

Project JSON should be versioned from the beginning so saved projects can be migrated as features change.

---

## 18. Frontend Architecture

### 18.1 Recommended Stack

```text
React
TypeScript
Vite or Next.js
Zustand
Web Audio API
Tone.js for MVP audio abstractions
Canvas 2D
mathjs or custom equation parser
KaTeX
CodeMirror 6
Dexie / IndexedDB
```

### 18.2 Why React

React works well for:

- project UI
- track lists
- inspectors
- editor panels
- timeline controls

The high-frequency audio and graph loops should remain outside React rendering.

### 18.3 State Separation

Separate state into three categories.

#### Project State

Persistent data:

- tracks
- equations
- BPM
- arrangement
- mappings

#### UI State

Transient data:

- selected track
- open panels
- zoom level
- editor focus

#### Runtime State

High-frequency state:

- current audio time
- playhead position
- audio nodes
- animation frame state

Runtime state should not trigger global React re-renders every frame.

---

## 19. Suggested Application Modules

```text
src/
  app/
  components/
    equation-editor/
    graph/
    transport/
    track-list/
    inspector/
    timeline/
  engine/
    math/
      parser.ts
      compiler.ts
      evaluator.ts
      dependencyGraph.ts
    audio/
      AudioEngine.ts
      Transport.ts
      Scheduler.ts
      instruments/
      effects/
    visuals/
      GraphRenderer.ts
      Camera.ts
      Sampler.ts
  state/
    projectStore.ts
    uiStore.ts
  persistence/
    indexedDb.ts
    projectSerializer.ts
  export/
    audioExport.ts
    midiExport.ts
    videoExport.ts
  workers/
    graph.worker.ts
```

---

## 20. Web Workers

Heavy graph evaluation should eventually move into a Web Worker.

Main thread:

- user input
- UI rendering
- Canvas drawing

Worker:

- expression evaluation
- graph point generation
- dependency calculations

AudioWorklet:

- audio-rate DSP only

This creates three isolated performance domains:

```text
UI Thread
Math Worker
Audio Thread
```

---

## 21. Persistence

### 21.1 Anonymous Users

Projects should automatically save to IndexedDB.

Users should be able to:

- create projects
- rename projects
- duplicate projects
- export project JSON
- import project JSON

No account should be required.

### 21.2 Accounts - Later

Accounts add:

- cloud saves
- share links
- public project gallery
- remix/fork
- profile pages

Potential backend:

```text
Supabase
```

or:

```text
PostgreSQL + object storage + lightweight API
```

For an MVP, local-first storage keeps deployment simple and cheap.

---

## 22. Sharing

A major product feature should be the ability to share a composition with one link.

Example:

```text
/app/project/abc123
```

Viewer mode should allow:

- Play/Pause
- graph interaction
- equation inspection
- optional remix

The creator can choose:

- private
- unlisted
- public

This is a later feature if the first version is entirely local.

---

## 23. Export

### 23.1 Audio Export

Support:

- WAV first
- MP3 later if browser-side encoding is practical

For deterministic export, use `OfflineAudioContext` rather than recording real-time playback.

### 23.2 MIDI Export

For event/pitch tracks, export:

- notes
- velocity
- timing
- track names

This lets users continue producing in Ableton, FL Studio, Logic, etc.

### 23.3 Video Export

Video export should eventually be a core differentiator.

Target:

- 1080p
- 30 or 60 FPS
- synchronized audio
- configurable aspect ratio

Presets:

```text
16:9 YouTube
9:16 TikTok / Reels / Shorts
1:1 Square
```

Implementation options:

1. Canvas `captureStream()` + `MediaRecorder` for an initial browser-native export.
2. WebCodecs for more control later.
3. Optional server rendering only if browser rendering becomes insufficient.

The initial version should avoid server-side rendering costs.

---

## 24. Undo / Redo

Equation editing and track configuration need reliable undo and redo from the start.

Recommended actions to record:

- expression changes
- track add/delete
- parameter changes
- mapping changes
- arrangement changes

Typing should be grouped into sensible history batches instead of producing one undo step per character.

---

## 25. Error Handling

Errors should appear inline and should never stop audio for unrelated tracks.

Examples:

```text
Unknown function: snn
```

```text
Division by zero near x = 4.0
```

```text
Circular dependency: A -> B -> A
```

```text
Function produced a value outside the allowed audio range
```

A broken track should be muted automatically while the rest of the project continues playing.

---

## 26. Performance Requirements

Initial targets:

- graph animation: stable 60 FPS on a typical modern laptop
- input-to-graph response: under 50 ms for normal functions
- audio scheduling jitter: not perceptible during typical playback
- project size: 32 simultaneous tracks for MVP target
- graph: several thousand visible samples per track
- startup: interactive within roughly 2 seconds on broadband after caching

The graph renderer may lower sampling density during active interaction and restore higher quality after the user stops zooming or panning.

---

## 27. Accessibility

Required:

- keyboard-accessible controls
- visible focus states
- screen-reader labels
- sufficient contrast
- reduced-motion preference
- graph colors not used as the only track identifier

A musical application will never be fully represented visually or textually, but basic editing and transport should remain accessible.

---

## 28. Browser Support

Primary:

- Chrome / Chromium
- Edge
- Firefox
- Safari

Desktop should be the development priority.

Mobile browsers should support:

- playback
- equation editing
- simple track creation
- project viewing

Some advanced audio/export functionality may initially remain desktop-only.

Remember that browsers generally require a user gesture before starting an `AudioContext`.

---

## 29. Security

### 29.1 Expression Sandbox

Never execute raw user JavaScript.

Only evaluate parsed mathematical AST nodes.

### 29.2 Imported Projects

Treat project files as untrusted input.

Validate:

- schema
- string lengths
- expression lengths
- track counts
- sample metadata
- project version

### 29.3 Resource Limits

Prevent expressions from freezing the browser.

Limits should include:

- maximum expression length
- maximum AST depth
- maximum nested function depth
- maximum dependency count
- sampling budget
- worker timeout / cancellation

---

## 30. MVP Scope

The MVP should prove one question:

> Is writing equations an enjoyable and understandable way to make music in a browser?

### MVP Must Have

- browser-based studio
- multiple equation tracks
- equation parser
- live graphing
- play/pause/stop
- BPM control
- loop region
- x-axis measured in beats
- Control Mode
- Event Mode
- basic synth
- kick/snare/hat samples or synthesized drums
- pitch mapping
- trigger mapping
- amplitude mapping
- scale quantization
- mute/solo
- named functions
- modulo and piecewise expressions
- local autosave
- project JSON import/export
- WAV export
- example projects

### MVP Should Have

- dark/light visual themes
- section-based track activation
- simple effects
- MIDI export
- shareable static project file

### MVP Should Not Have

- real-time collaboration
- plugin ecosystem
- VST support
- advanced mastering tools
- complete DAW piano roll
- server-side rendering farm
- marketplace
- AI composition features
- full mobile editor parity

---

## 31. Development Phases

### Phase 0: Technical Prototype

Goal: prove math -> graph -> sound synchronization.

Build:

- one equation input
- one canvas graph
- one synth
- playhead
- BPM control
- `sin`, `mod`, `floor`, and basic arithmetic

Success criteria:

Typing an equation changes both the visible graph and the sound without reloading the page.

### Phase 1: Multi-Track Composer

Build:

- track list
- multiple equations
- mute / solo
- instruments
- pitch and trigger mappings
- looping
- named functions

Success criteria:

A user can create a simple kick + bass + hat + lead composition entirely from equations.

### Phase 2: Arrangement and Polish

Build:

- sections
- track activation automation
- presets
- themes
- improved visual animation
- local project browser
- undo/redo

Success criteria:

A user can create a complete 30 to 60 second piece without using another application.

### Phase 3: Export and Sharing

Build:

- WAV export
- MIDI export
- video export
- project URLs
- cloud saving
- remix/fork flow

Success criteria:

A creator can publish a finished math-music animation to social media.

### Phase 4: Advanced Math Audio

Build:

- direct Signal Mode
- AudioWorklet function synthesis
- custom oscillators
- derivatives/integrals as modulation sources
- FFT/spectrum visualization
- advanced effects

---

## 32. MVP Acceptance Test

A tester should be able to complete the following workflow without documentation:

1. Open the site.
2. Click **New Project**.
3. Add a Kick track.
4. Enter an equation using `x mod 1`.
5. See the repeating graph update.
6. Map the expression to a kick trigger.
7. Add a Bass track.
8. Enter a repeating step equation.
9. Map it to synth pitch.
10. Set the project to 150 BPM.
11. Press Play.
12. Hear both tracks synchronized to the moving graph.
13. Add a Lead track and reference a named function.
14. Loop four bars.
15. Save locally.
16. Reload the browser and recover the project.
17. Export a WAV.

If this workflow feels understandable and musically responsive, the core product is working.

---

## 33. Important Technical Decision: Separate Music Meaning From Visual Meaning

The biggest architectural recommendation is to avoid assuming that every equation must directly represent raw audio samples.

Instead:

```text
Equation
   ↓
Mathematical value
   ↓
Mappings
   ↓
Musical parameters
```

This makes the tool dramatically more useful.

The same function can become:

- a melody
- a drum pattern
- an envelope
- an automation curve
- a visual graph

without requiring the function itself to oscillate thousands of times per second.

Direct equation-to-waveform synthesis can then exist as an advanced mode for users who specifically want it.

---

## 34. Recommended First Implementation

For a first serious build, use:

```text
Frontend:       React + TypeScript + Vite
State:          Zustand
Math Parser:    mathjs with a restricted environment
Math Display:   KaTeX
Editor:         CodeMirror 6
Graph:          Canvas 2D
Audio:          Tone.js + Web Audio API
Persistence:    IndexedDB via Dexie
Workers:        Web Worker for graph sampling
Hosting:        Vercel
```

This stack can produce the full local-first MVP without requiring a backend or paid infrastructure.

---

## 35. Recommended First Repository Milestone

The first repository milestone should contain only four major systems:

```text
1. Equation Editor
2. Safe Math Engine
3. Graph Renderer
4. Audio Transport
```

Do not build accounts, sharing, AI, or advanced exports until those four systems feel excellent.

A good initial demo would contain two equations:

```text
Kick:
pulse(1, 0.1)
```

and:

```text
Lead:
sequence(0, 2, 4, 7) + sin(x * pi) * 0.2
```

Pressing Play should immediately produce synchronized sound and animated curves.

That demo is enough to validate the core concept before expanding into a full product.

---

## 36. Future Ideas

After the core editor works, possible extensions include:

- public gallery of mathematical compositions
- remixing other creators' equations
- generative project templates
- collaborative multiplayer editing
- MIDI keyboard input
- microphone/audio-reactive functions
- OSC support
- game controller input
- live performance mode
- projection/fullscreen visualizer
- 3D parametric curves
- polar equations
- complex-number visualization
- Fourier transform tools
- derivatives as modulation signals
- integrals as accumulated control signals
- equation morphing between song sections
- shader-based backgrounds
- external MIDI output
- WebM/MP4 social export
- plugin SDK for custom instruments and mappings

---

## 37. Product Principle

The interface should make simple things easy without limiting complicated things.

A beginner should be able to write:

```text
sin(x)
```

and hear something interesting.

An advanced user should eventually be able to construct an entire composition from named, transformed, piecewise functions and export the result as a polished music visualization.

The math should remain visible, understandable, editable, and central to the experience at every stage.
