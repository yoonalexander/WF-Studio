import type { Project, Track } from "./model";
import { createMathEngine, clamp } from "./math";
import { collectEvents, eventAt, RESOLUTION } from "./music";
import type { MusicEvent } from "./music";
type Ctx = AudioContext | OfflineAudioContext;
function noiseBuffer(context: Ctx): AudioBuffer {
  const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * 0.6),
      context.sampleRate,
    ),
    data = buffer.getChannelData(0);
  let seed = 173;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = seed / 2147483648 - 1;
  }
  return buffer;
}
export function createBus(
  context: Ctx,
  project: Project,
  destination: AudioNode = context.destination,
) {
  const input = context.createGain(),
    gain = context.createGain(),
    compressor = context.createDynamicsCompressor();
  gain.gain.value = project.master * 0.5;
  compressor.threshold.value = -10;
  compressor.knee.value = 8;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  input.connect(gain);
  gain.connect(compressor);
  compressor.connect(destination);
  const delay = context.createDelay(2),
    feedback = context.createGain(),
    wet = context.createGain();
  delay.delayTime.value = (60 / project.bpm) * 0.75;
  feedback.gain.value = 0.3;
  wet.gain.value = project.delay;
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(gain);
  return {
    input,
    gain,
    wet,
    delay,
    dispose: () => {
      input.disconnect();
      gain.disconnect();
      compressor.disconnect();
      delay.disconnect();
      feedback.disconnect();
      wet.disconnect();
    },
  };
}
export function scheduleVoice(
  context: Ctx,
  destination: AudioNode,
  track: Track,
  event: MusicEvent,
  at: number,
  bpm: number,
  noise = noiseBuffer(context),
) {
  const t = Math.max(at, context.currentTime),
    env = context.createGain(),
    pan = context.createStereoPanner(),
    filter = context.createBiquadFilter();
  const duration = (event.duration * 60) / bpm;
  const drum = ["kick", "snare", "hat", "open-hat", "clap"].includes(
    track.instrument,
  );
  let length = drum
    ? track.instrument === "open-hat"
      ? 0.5
      : track.instrument === "kick"
        ? 0.35
        : track.instrument === "snare"
          ? 0.22
          : track.instrument === "clap"
            ? 0.18
            : 0.08
    : Math.max(duration, track.attack + 0.01) + track.release;
  length = clamp(length, 0.04, 8);
  env.gain.setValueAtTime(0.0001, t);
  pan.pan.value = event.pan;
  filter.type = drum && track.instrument !== "kick" ? "highpass" : "lowpass";
  filter.frequency.value = drum
    ? track.instrument.includes("hat")
      ? 7000
      : track.instrument === "kick"
        ? 2500
        : 900
    : event.cutoff;
  const level =
    clamp(track.volume * event.velocity, 0, 1) *
    (track.instrument === "kick" ? 1.2 : drum ? 0.55 : 0.32);
  env.connect(filter);
  filter.connect(pan);
  pan.connect(destination);
  const sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
  const osc = (wave: OscillatorType, freq: number) => {
    const o = context.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = track.detune;
    o.connect(env);
    sources.push(o);
    return o;
  };
  if (track.instrument === "kick") {
    const o = osc("sine", 150);
    o.frequency.exponentialRampToValueAtTime(43, t + 0.1);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, level), t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  } else if (drum) {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.connect(env);
    sources.push(source);
    if (track.instrument === "snare") osc("triangle", 185);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, level), t + 0.002);
    if (track.instrument === "clap") {
      for (let i = 1; i < 4; i++) {
        env.gain.setValueAtTime(0.0001, t + i * 0.012);
        env.gain.linearRampToValueAtTime(
          Math.max(0.0001, level),
          t + i * 0.012 + 0.003,
        );
      }
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  } else {
    osc(track.waveform, 440 * 2 ** ((event.note - 69) / 12));
    const attack = Math.min(track.attack, length / 3);
    const decay = Math.min(track.decay, length / 3);
    const releaseAt = Math.max(t + attack + decay, t + duration);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, level), t + attack);
    env.gain.linearRampToValueAtTime(
      Math.max(0.0001, level * track.sustain),
      t + attack + decay,
    );
    env.gain.setValueAtTime(Math.max(0.0001, level * track.sustain), releaseAt);
    env.gain.exponentialRampToValueAtTime(0.0001, releaseAt + track.release);
    length = releaseAt - t + track.release;
  }
  let ended = 0;
  sources.forEach((s) => {
    s.start(t);
    s.stop(t + length + 0.02);
    s.onended = () => {
      s.disconnect();
      if (++ended === sources.length) {
        env.disconnect();
        filter.disconnect();
        pan.disconnect();
      }
    };
  });
  const stop = () => {
    env.gain.cancelScheduledValues(context.currentTime);
    env.gain.setTargetAtTime(0.0001, context.currentTime, 0.005);
    sources.forEach((s) => {
      try {
        s.stop(context.currentTime + 0.03);
      } catch {
        /* Already ended. */
      }
    });
  };
  return Object.assign(stop, { endsAt: t + length + 0.02 });
}
export class AudioEngine {
  context?: AudioContext;
  playing = false;
  private project?: Project;
  private math = createMathEngine([]);
  private bus?: ReturnType<typeof createBus>;
  private noise?: AudioBuffer;
  private anchorTime = 0;
  private anchorBeat = 0;
  private stoppedBeat = 0;
  private nextTick = 0;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Map<() => void, number>();
  private starting = false;
  private generation = 0;
  metronome = false;
  onEnd?: () => void;
  private normalize(beat: number) {
    const p = this.project;
    if (p?.loop.enabled && beat >= p.loop.endBeat)
      return (
        p.loop.startBeat +
        ((beat - p.loop.startBeat) % (p.loop.endBeat - p.loop.startBeat))
      );
    return beat;
  }
  position() {
    return this.playing && this.context && this.project
      ? Math.max(
          0,
          this.normalize(
            this.anchorBeat +
              ((this.context.currentTime - this.anchorTime) *
                this.project.bpm) /
                60,
          ),
        )
      : this.stoppedBeat;
  }
  update(project: Project) {
    const pos = this.position();
    const changed = this.project !== project;
    this.project = project;
    this.math = createMathEngine(project.tracks, project.beatsPerBar);
    if (this.bus && this.context) {
      this.bus.gain.gain.setTargetAtTime(
        project.master * 0.5,
        this.context.currentTime,
        0.02,
      );
      this.bus.wet.gain.setTargetAtTime(
        project.delay,
        this.context.currentTime,
        0.02,
      );
      this.bus.delay.delayTime.setTargetAtTime(
        (60 / project.bpm) * 0.75,
        this.context.currentTime,
        0.02,
      );
    }
    if (this.playing && changed) this.seek(pos);
  }
  async play(project: Project) {
    if (this.playing || this.starting) return;
    this.starting = true;
    const generation = ++this.generation;
    this.update(project);
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return;
      this.noise ??= noiseBuffer(this.context);
      this.bus?.dispose();
      this.bus = createBus(this.context, project);
      if (
        this.stoppedBeat >= project.lengthBeats ||
        (project.loop.enabled && this.stoppedBeat >= project.loop.endBeat)
      )
        this.stoppedBeat = project.loop.enabled ? project.loop.startBeat : 0;
      this.anchorBeat = this.stoppedBeat;
      this.anchorTime = this.context.currentTime + 0.035;
      this.nextTick = Math.ceil(this.anchorBeat * RESOLUTION);
      this.playing = true;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 25);
    } finally {
      this.starting = false;
    }
  }
  private silence() {
    for (const stop of this.voices.keys()) stop();
    this.voices.clear();
  }
  pause() {
    this.generation++;
    if (!this.playing) return;
    this.stoppedBeat = Math.max(0, this.position());
    this.playing = false;
    clearInterval(this.timer);
    this.silence();
  }
  stop() {
    this.pause();
    this.stoppedBeat = this.project?.loop.enabled
      ? this.project.loop.startBeat
      : 0;
  }
  seek(beat: number) {
    this.stoppedBeat = clamp(beat, 0, this.project?.lengthBeats ?? 512);
    if (this.playing && this.context) {
      this.silence();
      this.anchorBeat = this.stoppedBeat;
      this.anchorTime = this.context.currentTime + 0.02;
      this.nextTick = Math.ceil(this.stoppedBeat * RESOLUTION);
    }
  }
  private schedule() {
    const ctx = this.context,
      p = this.project;
    if (!this.playing || !ctx || !p || !this.bus) return;
    const rawNow =
      this.anchorBeat + ((ctx.currentTime - this.anchorTime) * p.bpm) / 60;
    // Skip missed scheduling windows after tab suspension instead of bursting stale notes.
    if (this.nextTick / RESOLUTION < rawNow - 0.03)
      this.nextTick = Math.ceil(rawNow * RESOLUTION);
    for (const [stop, end] of this.voices)
      if (end < ctx.currentTime) this.voices.delete(stop);
    while (
      this.anchorTime +
        ((this.nextTick / RESOLUTION - this.anchorBeat) * 60) / p.bpm <
      ctx.currentTime + 0.12
    ) {
      const raw = this.nextTick / RESOLUTION,
        beat = this.normalize(raw),
        at = this.anchorTime + ((raw - this.anchorBeat) * 60) / p.bpm;
      if (!p.loop.enabled && beat >= p.lengthBeats) {
        if (rawNow >= p.lengthBeats) {
          this.pause();
          this.stoppedBeat = 0;
          this.onEnd?.();
        }
        return;
      }
      if (at >= ctx.currentTime) {
        for (const track of p.tracks) {
          const event = eventAt(p, track, beat, this.math);
          if (event && this.voices.size < 256) {
            const stop = scheduleVoice(
              ctx,
              this.bus.input,
              track,
              event,
              at,
              p.bpm,
              this.noise,
            );
            this.voices.set(stop, stop.endsAt);
          }
        }
        if (this.metronome && Math.abs(beat - Math.round(beat)) < 0.001) {
          const o = ctx.createOscillator(),
            g = ctx.createGain();
          o.frequency.value = beat % p.beatsPerBar === 0 ? 1200 : 800;
          g.gain.setValueAtTime(0.08, at);
          g.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
          o.connect(g);
          g.connect(this.bus.input);
          o.start(at);
          o.stop(at + 0.04);
          o.onended = () => {
            o.disconnect();
            g.disconnect();
          };
        }
      }
      this.nextTick++;
    }
  }
  async render(project: Project, start: number, end: number) {
    const seconds = ((end - start) * 60) / project.bpm;
    if (seconds > 180)
      throw new Error(
        "Export up to 3 minutes at a time. Shorten the loop range.",
      );
    const context = new OfflineAudioContext(
        2,
        Math.ceil((seconds + 3) * 44100),
        44100,
      ),
      bus = createBus(context, project),
      noise = noiseBuffer(context);
    const events = collectEvents(project, start, end);
    for (const event of events) {
      const t = project.tracks.find((t) => t.id === event.trackId)!;
      scheduleVoice(
        context,
        bus.input,
        t,
        event,
        ((event.beat - start) * 60) / project.bpm + 0.01,
        project.bpm,
        noise,
      );
    }
    const buffer = await context.startRendering();
    bus.dispose();
    return buffer;
  }
}
export const audio = new AudioEngine();
