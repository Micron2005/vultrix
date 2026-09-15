// Plucked-string synthesis (Karplus-Strong). A short noise burst is fed into a
// delay line the length of one period; each pass through the line is averaged
// with its neighbour, which damps the high partials faster than the low ones —
// exactly what a vibrating string does. Rendered offline into an AudioBuffer
// and cached per (variant, note, sample rate).

export type StringVariant = "acoustic" | "electric" | "pluck";

const VARIANTS: Record<
  StringVariant,
  {
    seconds: number;
    // 0..1 — how much of the burst's brightness survives (pick vs finger).
    brightness: number;
    // Per-period loss; closer to 1 = longer sustain.
    loss: number;
    // Blend of the averaging filter, 0.5 = classic KS; lower = darker faster.
    blend: number;
  }
> = {
  acoustic: { seconds: 2.4, brightness: 0.75, loss: 0.996, blend: 0.5 },
  electric: { seconds: 2.8, brightness: 0.45, loss: 0.9975, blend: 0.5 },
  pluck: { seconds: 0.9, brightness: 0.9, loss: 0.985, blend: 0.5 },
};

const cache = new Map<string, Float32Array<ArrayBuffer>>();

function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function renderString(
  variant: StringVariant,
  frequency: number,
  sampleRate: number,
): Float32Array<ArrayBuffer> {
  const key = `${variant}:${frequency.toFixed(2)}:${sampleRate}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const config = VARIANTS[variant];
  const period = Math.max(2, Math.round(sampleRate / frequency));
  const length = Math.floor(sampleRate * config.seconds);
  const output = new Float32Array(length);
  const random = seeded(Math.round(frequency * 100));

  // Excitation: white noise, low-passed by `brightness` so a duller pick has
  // less fizz, then DC-removed so the string doesn't drift.
  let previous = 0;
  let mean = 0;
  for (let index = 0; index < period; index += 1) {
    const white = random() * 2 - 1;
    previous = previous + (white - previous) * config.brightness;
    output[index] = previous;
    mean += previous;
  }
  mean /= period;
  for (let index = 0; index < period; index += 1) output[index] -= mean;

  // Higher notes have fewer samples per period so each averaging pass hits
  // them more often; scale the loss so sustain stays roughly even across the
  // fretboard.
  const loss = config.loss ** (110 / Math.max(frequency, 40));
  // The two-point average adds half a sample of delay; take it off the line
  // length and read at a fractional position so high notes stay in tune.
  const exact = Math.max(2, sampleRate / frequency - 0.5);
  const whole = Math.floor(exact);
  const fraction = exact - whole;
  for (let index = period; index < length; index += 1) {
    const read = index - whole;
    const a = output[read] * (1 - fraction) + (output[read - 1] ?? 0) * fraction;
    const b = (output[read - 1] ?? 0) * (1 - fraction) + (output[read - 2] ?? 0) * fraction;
    output[index] = loss * (config.blend * a + (1 - config.blend) * b);
  }

  // Fade the tail so a buffer that stops mid-vibration doesn't click.
  const fade = Math.min(length, Math.floor(sampleRate * 0.05));
  for (let index = 0; index < fade; index += 1) {
    output[length - 1 - index] *= index / fade;
  }

  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    peak = Math.max(peak, Math.abs(output[index]));
  }
  if (peak > 0) {
    for (let index = 0; index < length; index += 1) output[index] /= peak;
  }
  cache.set(key, output);
  return output;
}

export function stringBuffer(
  context: BaseAudioContext,
  variant: StringVariant,
  frequency: number,
): AudioBuffer {
  const samples = renderString(variant, frequency, context.sampleRate);
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}

export function overdriveCurve(drive: number) {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index / (curve.length - 1)) * 2 - 1;
    // Asymmetric soft clip: even harmonics read as "tube" rather than fuzz.
    const shaped = Math.tanh(input * drive + 0.15 * input * input);
    curve[index] = shaped / Math.tanh(drive + 0.15);
  }
  return curve;
}
