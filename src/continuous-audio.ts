import { createMathEngine, clamp } from "./math";
import type { Project } from "./model";
import type { MusicEvent } from "./music";
import { soundPreset, saturationCurve } from "./sounds";
import type { SoundId } from "./sounds";
import { IconicVoice } from "./iconic-voice";

// The one-equation page uses one sustained oscillator, rather than note events.
export class ContinuousAudio {
  context?: AudioContext;
  playing = false;
  private project?: Project;
  private math = createMathEngine([]);
  private oscillator?: OscillatorNode;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  private shaper?: WaveShaperNode;
  private iconic?: IconicVoice;
  private sound: SoundId = "electro";
  private volume = 1;
  private soundTimer?: ReturnType<typeof setTimeout>;
  private changingSound = false;
  private timer?: ReturnType<typeof setInterval>;
  private anchorTime = 0;
  private anchorBeat = 0;
  private stoppedBeat = 0;
  private xExtent?: number;
  private yExtent = Infinity;
  private speed = 1;
  private reveal = false;
  private revealed = 0;
  private acidLastValue?: number;
  private acidEnvelopeStarted = 0;
  private generation = 0;
  private extent() {
    return this.xExtent ?? this.project?.loop.endBeat ?? 0;
  }
  private elapsed() {
    return this.playing && this.context && this.project
      ? ((this.context.currentTime - this.anchorTime) *
          this.project.bpm *
          this.speed) /
          60
      : 0;
  }
  private revealDistance() {
    return Math.min(this.extent() * 2, this.revealed + this.elapsed());
  }
  revealBoundary() {
    if (!this.reveal || this.revealDistance() >= this.extent() * 2)
      return undefined;
    return -this.extent() + this.revealDistance();
  }
  setReveal(enabled: boolean) {
    if (enabled === this.reveal) return;
    this.reveal = enabled;
    if (enabled) this.restartReveal();
  }
  restartReveal() {
    this.revealed = 0;
    this.reanchor(-this.extent());
  }
  setSpeed(value: number) {
    if (!Number.isFinite(value)) return;
    const beat = this.position();
    this.revealed = this.revealDistance();
    this.speed = clamp(value, 0.25, 4);
    this.reanchor(beat);
  }
  setYExtent(extent: number) {
    this.yExtent = extent;
    this.control();
  }
  private isVisible(value: number) {
    return (
      Number.isFinite(value) &&
      this.yExtent > 0 &&
      Math.abs(value) <= this.yExtent &&
      (this.xExtent ?? this.project?.loop.endBeat ?? 0) > 0
    );
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = clamp(value, 0, 1);
    this.control();
  }
  setSound(id: SoundId) {
    if (id === this.sound) return;
    this.sound = id;
    if (!this.context || !this.oscillator || !this.gain) return;
    clearTimeout(this.soundTimer);
    // Briefly soften the existing voice before changing its harmonics.
    this.changingSound = true;
    this.control();
    this.soundTimer = setTimeout(() => {
      this.configureSound();
      this.changingSound = false;
      this.control();
    }, 16);
  }
  private configureSound() {
    if (!this.context || !this.oscillator || !this.filter || !this.shaper)
      return;
    const preset = soundPreset(this.sound);
    this.acidLastValue = undefined;
    if (preset.waveform === "custom") {
      const harmonics = preset.harmonics ?? [0, 1];
      const real = new Float32Array(harmonics.length);
      const imaginary = Float32Array.from(harmonics);
      this.oscillator.setPeriodicWave(
        this.context.createPeriodicWave(real, imaginary),
      );
    } else this.oscillator.type = preset.waveform;
    this.shaper.curve = saturationCurve(preset.drive);
    this.filter.frequency.setTargetAtTime(
      preset.cutoff,
      this.context.currentTime,
      0.02,
    );
    this.filter.Q.setTargetAtTime(
      preset.resonance,
      this.context.currentTime,
      0.02,
    );
    this.iconic?.configure(preset);
  }
  update(project: Project, xExtent = this.xExtent) {
    const beat = this.position();
    const changed =
      this.extent() !== (xExtent ?? project.loop.endBeat) ||
      this.project?.tracks[0]?.expression !== project.tracks[0]?.expression;
    this.revealed = this.revealDistance();
    this.project = project;
    this.xExtent = xExtent;
    this.math = createMathEngine(project.tracks, project.beatsPerBar);
    if (this.reveal && changed) this.restartReveal();
    else this.reanchor(beat);
  }
  position() {
    const p = this.project;
    if (!p) return 0;
    const raw = this.playing
      ? this.anchorBeat + this.elapsed()
      : this.stoppedBeat;
    const extent = this.xExtent ?? p.loop.endBeat;
    if (extent === 0) return 0;
    // Keep the clock precise even when the visible range is very large.
    if (raw >= -extent && raw < extent) return raw;
    const span = extent * 2;
    const wrapped = raw % span;
    return wrapped < -extent
      ? wrapped + span
      : wrapped >= extent
        ? wrapped - span
        : wrapped;
  }
  seek(beat: number) {
    this.revealed = this.revealDistance();
    if (this.reveal)
      this.revealed = Math.max(
        this.revealed,
        clamp(beat + this.extent(), 0, this.extent() * 2),
      );
    this.reanchor(beat);
  }
  private reanchor(beat: number) {
    this.stoppedBeat = beat;
    this.anchorBeat = beat;
    this.anchorTime = this.context?.currentTime ?? 0;
    this.control();
  }
  private control() {
    if (!this.context || !this.oscillator || !this.gain || !this.project)
      return;
    const track = this.project.tracks[0];
    const value = this.math.value(track.id, this.position());
    const valid = this.isVisible(value) && !this.math.errors[track.id];
    const now = this.context.currentTime;
    const preset = soundPreset(this.sound);
    let frequency = 0;
    if (valid) {
      frequency =
        440 *
        2 **
          ((track.baseNote - 69 + preset.octave + clamp(value, -48, 48)) / 12);
      this.oscillator.frequency.setTargetAtTime(
        frequency,
        now,
        preset.glide ?? 0.008,
      );
    }
    if (preset.id === "acid-303" && this.filter) {
      // The equation supplies articulation: pitch jumps and returns from a
      // rest open the filter. Smooth curves glide without an imposed grid.
      if (
        valid &&
        (this.acidLastValue === undefined ||
          Math.abs(value - this.acidLastValue) >= 0.75)
      )
        this.acidEnvelopeStarted = now;
      if (valid) {
        const envelope = Math.exp(
          -(now - this.acidEnvelopeStarted) / (preset.envelopeDecay ?? 0.18),
        );
        const cutoff =
          preset.cutoff * 2 ** (clamp(value, -24, 24) / 12) +
          (preset.envelopeRange ?? 0) * envelope;
        this.filter.frequency.setTargetAtTime(
          Math.min(7000, cutoff),
          now,
          0.01,
        );
      }
      this.acidLastValue = valid ? value : undefined;
    }
    const articulation = this.iconic?.update(frequency, value, valid) ?? 1;
    this.gain.gain.setTargetAtTime(
      valid && !this.changingSound
        ? preset.level * this.volume * articulation
        : 0,
      now,
      0.012,
    );
  }
  soundingNotes(): MusicEvent[] {
    if (!this.playing || !this.oscillator || !this.project) return [];
    const track = this.project.tracks[0],
      beat = this.position();
    const value = this.math.value(track.id, beat);
    if (!this.isVisible(value) || this.math.errors[track.id]) return [];
    return [
      {
        trackId: track.id,
        beat,
        value,
        note: track.baseNote + soundPreset(this.sound).octave + value,
        velocity: 1,
        duration: 0,
        cutoff: 16000,
        pan: 0,
      },
    ];
  }
  async play(project: Project) {
    if (this.playing) return;
    const generation = ++this.generation;
    this.update(project);
    this.context ??= new AudioContext();
    await this.context.resume();
    if (generation !== this.generation) return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      filter = this.context.createBiquadFilter(),
      shaper = this.context.createWaveShaper();
    filter.type = "lowpass";
    shaper.oversample = "2x";
    gain.gain.value = 0;
    oscillator.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);
    const iconic = new IconicVoice(
      this.context,
      oscillator,
      shaper,
      filter,
      gain,
    );
    oscillator.onended = () => {
      iconic.dispose();
      oscillator.disconnect();
      shaper.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.oscillator = oscillator;
    this.gain = gain;
    this.filter = filter;
    this.shaper = shaper;
    this.iconic = iconic;
    this.changingSound = false;
    this.configureSound();
    this.anchorBeat = this.stoppedBeat;
    this.anchorTime = this.context.currentTime;
    this.playing = true;
    this.control();
    oscillator.start();
    this.timer = setInterval(() => this.control(), 16);
  }
  pause() {
    this.generation++;
    this.revealed = this.revealDistance();
    this.stoppedBeat = this.position();
    this.playing = false;
    clearInterval(this.timer);
    clearTimeout(this.soundTimer);
    this.changingSound = false;
    if (this.oscillator && this.context && this.gain) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
      this.oscillator.stop(this.context.currentTime + 0.04);
    }
    this.oscillator = undefined;
    this.iconic = undefined;
    this.gain = undefined;
    this.filter = undefined;
    this.shaper = undefined;
  }
}
export const continuousAudio = new ContinuousAudio();
