import type { BeatTrack } from "./kits";

// "Drums" kit: modelled after an acoustic kit rather than a drum machine —
// tuned shell modes with pitch drop for the kick/toms/snare, wire rattle and
// stick click on the snare, and inharmonic metallic partials for the cymbals.

type Ctx = BaseAudioContext;

const HAT_PARTIALS = [1, 1.8, 2.02, 2.55, 2.63, 3.9];

function envelope(context: Ctx, time: number, peak: number, attack: number, decay: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return gain;
}

function tone(
  context: Ctx,
  destination: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  glide: number,
  peak: number,
  time: number,
  decay: number,
) {
  const gain = envelope(context, time, peak, 0.002, decay);
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, time);
  if (to !== from) {
    oscillator.frequency.exponentialRampToValueAtTime(to, time + glide);
  }
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + decay + 0.03);
}

function noise(
  context: Ctx,
  destination: AudioNode,
  buffer: AudioBuffer,
  filterType: BiquadFilterType,
  frequency: number,
  q: number,
  peak: number,
  time: number,
  decay: number,
  attack = 0.001,
) {
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = envelope(context, time, peak, attack, decay);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + attack + decay + 0.03);
}

function metal(
  context: Ctx,
  destination: AudioNode,
  base: number,
  bandpass: number,
  peak: number,
  time: number,
  decay: number,
) {
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = bandpass;
  filter.Q.value = 0.7;
  const high = context.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 6000;
  const gain = envelope(context, time, peak, 0.001, decay);
  filter.connect(high);
  high.connect(gain);
  gain.connect(destination);
  for (const ratio of HAT_PARTIALS) {
    const oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = base * ratio;
    oscillator.connect(filter);
    oscillator.start(time);
    oscillator.stop(time + decay + 0.03);
  }
}

export function scheduleRealDrum(
  context: Ctx,
  destination: AudioNode,
  voice: BeatTrack,
  level: number,
  time: number,
  noiseBuffer: AudioBuffer,
) {
  const peak = Math.min(1, level * 0.7);
  switch (voice) {
    case "kick":
      tone(context, destination, "sine", 160, 52, 0.045, peak, time, 0.38);
      tone(context, destination, "triangle", 95, 60, 0.03, peak * 0.4, time, 0.07);
      noise(context, destination, noiseBuffer, "bandpass", 3600, 1.2, peak * 0.35, time, 0.009);
      return;
    case "snare":
      tone(context, destination, "sine", 196, 180, 0.02, peak * 0.55, time, 0.13);
      tone(context, destination, "sine", 330, 300, 0.02, peak * 0.3, time, 0.09);
      noise(context, destination, noiseBuffer, "highpass", 1400, 0.7, peak * 0.6, time, 0.2);
      noise(context, destination, noiseBuffer, "bandpass", 4200, 1.5, peak * 0.4, time, 0.012);
      return;
    case "clap":
      for (const offset of [0, 0.011, 0.022]) {
        noise(context, destination, noiseBuffer, "bandpass", 1300, 1.1, peak * 0.5, time + offset, 0.018);
      }
      noise(context, destination, noiseBuffer, "bandpass", 1500, 0.9, peak * 0.4, time + 0.033, 0.16);
      return;
    case "chh":
      metal(context, destination, 2050, 9000, peak * 0.45, time, 0.05);
      noise(context, destination, noiseBuffer, "highpass", 8000, 0.7, peak * 0.25, time, 0.04);
      return;
    case "ohh":
      metal(context, destination, 2050, 8500, peak * 0.4, time, 0.32);
      noise(context, destination, noiseBuffer, "highpass", 7000, 0.7, peak * 0.22, time, 0.28);
      return;
    case "tom":
      tone(context, destination, "sine", 150, 98, 0.12, peak * 0.9, time, 0.42);
      noise(context, destination, noiseBuffer, "bandpass", 1200, 1, peak * 0.3, time, 0.02);
      return;
    case "rim":
      tone(context, destination, "square", 1720, 1720, 0, peak * 0.2, time, 0.04);
      tone(context, destination, "sine", 480, 470, 0.03, peak * 0.4, time, 0.06);
      noise(context, destination, noiseBuffer, "bandpass", 2200, 2, peak * 0.4, time, 0.01);
      return;
    case "perc":
      tone(context, destination, "sine", 630, 630, 0, peak * 0.35, time, 0.5);
      tone(context, destination, "sine", 1110, 1110, 0, peak * 0.2, time, 0.4);
      noise(context, destination, noiseBuffer, "highpass", 5000, 0.7, peak * 0.3, time, 0.6, 0.002);
      return;
  }
}
