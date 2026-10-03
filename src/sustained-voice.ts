import type { Track } from "./model";
import type { MusicEvent } from "./music";

type Context = AudioContext | OfflineAudioContext;
export const usesNoise = (track: Track) =>
  !["synth", "bass", "kick"].includes(track.instrument);

export function sustainedVoice(
  context: Context,
  destination: AudioNode,
  track: Track,
  noise: AudioBuffer,
  at: number,
) {
  const gain = context.createGain(),
    filter = context.createBiquadFilter(),
    pan = context.createStereoPanner();
  const kind = usesNoise(track);
  const oscillator = kind ? undefined : context.createOscillator();
  const source = oscillator ?? context.createBufferSource();
  if (!oscillator) {
    const buffer = source as AudioBufferSourceNode;
    buffer.buffer = noise;
    buffer.loop = true;
  }
  gain.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    pan.disconnect();
  };
  source.start(at);
  let stopped = false;
  return {
    kind,
    control(current: Track, event: MusicEvent | undefined, time: number) {
      if (stopped) return;
      if (oscillator) {
        oscillator.type =
          current.instrument === "kick" ? "sine" : current.waveform;
        oscillator.detune.setTargetAtTime(current.detune, time, 0.008);
        if (event)
          oscillator.frequency.setTargetAtTime(
            440 * 2 ** ((event.note - 69) / 12),
            time,
            0.008,
          );
      }
      filter.type = kind ? "highpass" : "lowpass";
      filter.frequency.setTargetAtTime(
        event?.cutoff ?? current.cutoff,
        time,
        0.012,
      );
      pan.pan.setTargetAtTime(event?.pan ?? current.pan, time, 0.012);
      gain.gain.setTargetAtTime(
        event ? current.volume * event.velocity * (kind ? 0.12 : 0.2) : 0,
        time,
        0.012,
      );
    },
    stop(time = context.currentTime) {
      if (stopped) return;
      stopped = true;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setTargetAtTime(0, time, 0.008);
      source.stop(time + 0.06);
    },
  };
}
