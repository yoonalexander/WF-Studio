import { createMathEngine, clamp } from "./math";
import type { Project } from "./model";
import type { MusicEvent } from "./music";
import { compositionRange } from "./simple";
import { soundPreset, saturationCurve } from "./sounds";
import type { SoundId } from "./sounds";

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
  private sound: SoundId = "electro";
  private soundTimer?: ReturnType<typeof setTimeout>;
  private changingSound = false;
  private timer?: ReturnType<typeof setInterval>;
  private anchorTime = 0;
  private anchorBeat = 0;
  private stoppedBeat = 0;
  private generation = 0;
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
    if (preset.waveform === "custom") {
      const real = new Float32Array(preset.harmonics.length);
      const imaginary = Float32Array.from(preset.harmonics);
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
  }
  update(project: Project) {
    const beat = this.position();
    this.project = project;
    this.math = createMathEngine(project.tracks, project.beatsPerBar);
    this.seek(beat);
    this.control();
  }
  position() {
    const p = this.project;
    if (!p) return 0;
    const raw =
      this.playing && this.context
        ? this.anchorBeat +
          ((this.context.currentTime - this.anchorTime) * p.bpm) / 60
        : this.stoppedBeat;
    const { start, span } = compositionRange(p, true);
    return start + ((((raw - start) % span) + span) % span);
  }
  seek(beat: number) {
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
    const valid = Number.isFinite(value) && !this.math.errors[track.id];
    const now = this.context.currentTime;
    const preset = soundPreset(this.sound);
    if (valid) {
      const frequency =
        440 *
        2 **
          ((track.baseNote - 69 + preset.octave + clamp(value, -48, 48)) / 12);
      this.oscillator.frequency.setTargetAtTime(frequency, now, 0.008);
    }
    this.gain.gain.setTargetAtTime(
      valid && !this.changingSound ? preset.level : 0,
      now,
      0.012,
    );
  }
  soundingNotes(): MusicEvent[] {
    if (!this.playing || !this.oscillator || !this.project) return [];
    const track = this.project.tracks[0],
      beat = this.position();
    const value = this.math.value(track.id, beat);
    if (!Number.isFinite(value) || this.math.errors[track.id]) return [];
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
    oscillator.onended = () => {
      oscillator.disconnect();
      shaper.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.oscillator = oscillator;
    this.gain = gain;
    this.filter = filter;
    this.shaper = shaper;
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
    this.gain = undefined;
    this.filter = undefined;
    this.shaper = undefined;
  }
}
export const continuousAudio = new ContinuousAudio();
