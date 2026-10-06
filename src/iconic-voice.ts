import type { SoundPreset, SoundRecipe } from "./sounds";

// These layers/effects are a single sustained voice. Articulation follows
// equation jumps and rests, never a scheduler of repeated note starts.
export class IconicVoice {
  private nodes: AudioNode[] = [];
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private layers: { oscillator: OscillatorNode; ratio: number }[] = [];
  private modulator?: OscillatorNode;
  private fmDepth?: GainNode;
  private formants: BiquadFilterNode[] = [];
  private recipe?: SoundRecipe;
  private preset?: SoundPreset;
  private lastValue?: number;
  private started = 0;
  private lastTable = -Infinity;
  private mainLevel?: GainNode;

  constructor(
    private context: AudioContext,
    private oscillator: OscillatorNode,
    private input: WaveShaperNode,
    private filter: BiquadFilterNode,
    private output: GainNode,
  ) {}

  private node<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  private source<T extends OscillatorNode | AudioBufferSourceNode>(node: T): T {
    this.sources.push(node);
    this.nodes.push(node);
    return node;
  }
  private gain(level: number) {
    const gain = this.node(this.context.createGain());
    gain.gain.value = level;
    return gain;
  }
  private lfo(rate: number, depth: number, parameters: AudioParam[]) {
    const oscillator = this.source(this.context.createOscillator());
    const amount = this.gain(depth);
    oscillator.frequency.value = rate;
    oscillator.connect(amount);
    parameters.forEach((parameter) => amount.connect(parameter));
    oscillator.start();
  }
  configure(preset: SoundPreset) {
    this.dispose();
    const recipe = preset.recipe;
    if (!recipe) return;
    this.preset = preset;
    this.recipe = recipe;
    this.lastValue = undefined;
    this.lastTable = -Infinity;
    const weight =
      1 + (recipe.layers ?? []).reduce((sum, l) => sum + l.level, 0);
    this.mainLevel = this.gain(1 / weight);
    this.oscillator.disconnect(this.input);
    this.oscillator.connect(this.mainLevel);
    this.mainLevel.connect(this.input);
    for (const layer of recipe.layers ?? []) {
      const oscillator = this.source(this.context.createOscillator());
      oscillator.type =
        layer.waveform ??
        (preset.waveform === "custom" ? "sine" : preset.waveform);
      oscillator.detune.value = layer.cents ?? 0;
      const gain = this.gain(layer.level / weight);
      oscillator.connect(gain);
      gain.connect(this.input);
      this.layers.push({
        oscillator,
        ratio: 2 ** ((layer.semitones ?? 0) / 12),
      });
      oscillator.start();
    }
    if (recipe.fm) {
      this.modulator = this.source(this.context.createOscillator());
      this.fmDepth = this.gain(0);
      this.modulator.connect(this.fmDepth);
      this.fmDepth.connect(this.oscillator.frequency);
      this.modulator.start();
    }
    if (recipe.vibrato)
      this.lfo(recipe.vibrato.rate, recipe.vibrato.cents, [
        this.oscillator.detune,
        ...this.layers.map((l) => l.oscillator.detune),
      ]);
    if (recipe.noise) {
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate / 2,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = this.source(this.context.createBufferSource());
      source.buffer = buffer;
      source.loop = true;
      const gain = this.gain(recipe.noise);
      source.connect(gain);
      gain.connect(this.input);
      source.start();
    }

    // Every wet path rejoins BEFORE the visibility/mute gain. Echo and chorus
    // cannot keep sounding after the equation becomes undefined or offscreen.
    this.filter.disconnect(this.output);
    const dry = this.gain(recipe.formants ? 0.15 : 1);
    this.filter.connect(dry);
    dry.connect(this.output);
    if (recipe.formants) {
      for (const frequency of recipe.formants) {
        const formant = this.node(this.context.createBiquadFilter());
        formant.type = "bandpass";
        formant.frequency.value = frequency;
        formant.Q.value = 5;
        const gain = this.gain(1.8 / recipe.formants.length);
        this.filter.connect(formant);
        formant.connect(gain);
        gain.connect(this.output);
        this.formants.push(formant);
      }
    }
    if (recipe.chorus) {
      for (const direction of [-1, 1]) {
        const delay = this.node(this.context.createDelay(0.1));
        delay.delayTime.value = direction < 0 ? 0.016 : 0.022;
        const pan = this.node(this.context.createStereoPanner());
        pan.pan.value = direction;
        const wet = this.gain(0.22);
        this.filter.connect(delay);
        delay.connect(pan);
        pan.connect(wet);
        wet.connect(this.output);
        this.lfo(direction < 0 ? 0.63 : 0.81, 0.003, [delay.delayTime]);
      }
    }
    if (recipe.delay) {
      const delay = this.node(this.context.createDelay(1));
      delay.delayTime.value = recipe.delay.time;
      const feedback = this.gain(recipe.delay.feedback);
      const damping = this.node(this.context.createBiquadFilter());
      damping.frequency.value = 2500;
      const wet = this.gain(recipe.delay.wet);
      this.filter.connect(delay);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);
      damping.connect(wet);
      wet.connect(this.output);
    }
  }

  update(frequency: number, value: number, valid: boolean) {
    const recipe = this.recipe,
      preset = this.preset;
    if (!recipe || !preset) return 1;
    const now = this.context.currentTime;
    if (!valid) {
      this.lastValue = undefined;
      return 1;
    }
    if (
      this.lastValue === undefined ||
      Math.abs(value - this.lastValue) >= 0.75
    )
      this.started = now;
    this.lastValue = value;
    const age = now - this.started;
    const glide = preset.glide ?? 0.008;
    for (const layer of this.layers)
      layer.oscillator.frequency.setTargetAtTime(
        Math.min(this.context.sampleRate * 0.4, frequency * layer.ratio),
        now,
        glide,
      );
    if (this.modulator && this.fmDepth && recipe.fm) {
      this.modulator.frequency.setTargetAtTime(
        Math.min(this.context.sampleRate * 0.4, frequency * recipe.fm.ratio),
        now,
        glide,
      );
      const index =
        recipe.fm.sustain +
        (recipe.fm.index - recipe.fm.sustain) *
          Math.exp(-age / recipe.fm.decay);
      this.fmDepth.gain.setTargetAtTime(frequency * index, now, 0.012);
    }
    if (recipe.pitchDrop)
      this.oscillator.detune.setTargetAtTime(
        recipe.pitchDrop * 100 * Math.exp(-age / 0.035),
        now,
        0.008,
      );
    if (recipe.arp) {
      const semitones = [0, 4, 7][Math.floor(now * 18) % 3];
      this.oscillator.frequency.setTargetAtTime(
        frequency * 2 ** (semitones / 12),
        now,
        0.002,
      );
    }
    if (recipe.filterRange) {
      const envelope = Math.exp(-age / (recipe.filterDecay ?? 0.3));
      this.filter.frequency.setTargetAtTime(
        Math.min(
          14000,
          preset.cutoff * 2 ** (Math.max(-24, Math.min(24, value)) / 36) +
            recipe.filterRange * envelope,
        ),
        now,
        0.012,
      );
    }
    if (recipe.talking) {
      const vowels = [
        [350, 1800, 2600],
        [700, 1100, 2450],
        [450, 800, 2200],
      ];
      const phase = (now * 0.45 + value / 24) % 3;
      const wrapped = (phase + 3) % 3,
        index = Math.floor(wrapped),
        mix = wrapped - index;
      this.formants.forEach((formant, i) => {
        const a = vowels[index][i],
          b = vowels[(index + 1) % 3][i];
        formant.frequency.setTargetAtTime(a + (b - a) * mix, now, 0.04);
      });
    }
    if (recipe.table && now - this.lastTable >= 0.08) {
      this.oscillator.setPeriodicWave(this.table(recipe.table, now, age));
      this.lastTable = now;
    }
    const attack = recipe.attack ? 1 - Math.exp(-age / recipe.attack) : 1;
    const sustain = recipe.sustain ?? 1;
    const decay = recipe.decay
      ? sustain + (1 - sustain) * Math.exp(-age / recipe.decay)
      : 1;
    const motion = recipe.tremolo
      ? 1 -
        recipe.tremolo.depth *
          (0.5 + 0.5 * Math.cos(now * 2 * Math.PI * recipe.tremolo.rate))
      : 1;
    return attack * decay * motion;
  }

  private table(
    kind: NonNullable<SoundRecipe["table"]>,
    time: number,
    age: number,
  ) {
    const real = new Float32Array(49),
      imaginary = new Float32Array(49);
    if (kind === "sync") {
      // A slave saw reset at every master cycle, reconstructed as harmonics.
      const ratio = 1.5 + 3 * Math.exp(-age / 0.7) + 0.3 * Math.sin(time);
      for (let k = 1; k < real.length; k++) {
        for (let i = 0; i < 256; i++) {
          const phase = i / 256,
            value = 2 * ((phase * ratio) % 1) - 1;
          real[k] += (value * Math.cos(2 * Math.PI * k * phase)) / 128;
          imaginary[k] += (value * Math.sin(2 * Math.PI * k * phase)) / 128;
        }
      }
    } else if (kind === "wavetable") {
      const morph = 0.5 + 0.5 * Math.sin(time * 0.7);
      for (let k = 1; k < imaginary.length; k++)
        imaginary[k] =
          (1 - morph) / k +
          (morph * Math.sin(k * 1.8 + time * 0.15)) / Math.sqrt(k);
      imaginary[1] = 1;
    } else {
      let duty = 0.3 + 0.18 * Math.sin(time * (kind === "sid" ? 2.3 : 0.7));
      if (kind === "sid") duty = Math.round(duty * 16) / 16;
      for (let k = 1; k < real.length; k++) {
        real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
        imaginary[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
      }
    }
    return this.context.createPeriodicWave(real, imaginary);
  }

  dispose() {
    for (const source of this.sources) source.stop();
    if (this.mainLevel) {
      this.oscillator.disconnect(this.mainLevel);
      this.oscillator.connect(this.input);
    }
    this.nodes.forEach((node) => node.disconnect());
    this.filter.disconnect();
    this.filter.connect(this.output);
    this.oscillator.detune.setValueAtTime(0, this.context.currentTime);
    this.nodes = [];
    this.sources = [];
    this.layers = [];
    this.formants = [];
    this.modulator = undefined;
    this.fmDepth = undefined;
    this.mainLevel = undefined;
    this.recipe = undefined;
    this.preset = undefined;
  }
}
