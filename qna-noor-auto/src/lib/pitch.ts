export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const YIN_THRESHOLD = 0.15;
const MIN_PITCH_HZ = 60;
const MAX_PITCH_HZ = 1200;

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
): { hz: number; clarity: number } | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < 32) {
    return null;
  }

  let mean = 0;
  let squareSum = 0;
  for (const sample of samples) {
    mean += sample;
    squareSum += sample * sample;
  }
  mean /= samples.length;
  if (Math.sqrt(squareSum / samples.length) < 0.01) return null;

  const decimation = Math.max(1, Math.ceil(sampleRate / 8000));
  const workingLength = Math.floor(samples.length / decimation);
  if (workingLength < 8) return null;

  const working = new Float32Array(workingLength);
  for (let index = 0; index < workingLength; index += 1) {
    let sum = 0;
    const start = index * decimation;
    for (let offset = 0; offset < decimation; offset += 1) {
      sum += samples[start + offset] - mean;
    }
    working[index] = sum / decimation;
  }

  const effectiveSampleRate = sampleRate / decimation;
  const minTau = Math.max(2, Math.floor(effectiveSampleRate / MAX_PITCH_HZ));
  const maxTau = Math.min(
    Math.floor(working.length / 2),
    Math.ceil(effectiveSampleRate / MIN_PITCH_HZ),
  );
  if (maxTau <= minTau + 1) return null;

  const difference = new Float64Array(maxTau + 1);
  const normalized = new Float64Array(maxTau + 1);
  let cumulativeDifference = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = working.length - tau;
    for (let index = 0; index < limit; index += 1) {
      const delta = working[index] - working[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
    cumulativeDifference += sum;
    normalized[tau] =
      cumulativeDifference === 0 ? 1 : (sum * tau) / cumulativeDifference;
  }

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (normalized[tau] < YIN_THRESHOLD) {
      tauEstimate = tau;
      while (
        tauEstimate < maxTau &&
        normalized[tauEstimate + 1] < normalized[tauEstimate]
      ) {
        tauEstimate += 1;
      }
      break;
    }
  }
  if (tauEstimate < 0) return null;

  const left = normalized[tauEstimate - 1];
  const center = normalized[tauEstimate];
  const right = normalized[tauEstimate + 1] ?? center;
  const denominator = left - 2 * center + right;
  const adjustment =
    denominator === 0 ? 0 : 0.5 * ((left - right) / denominator);
  const refinedTau = tauEstimate + Math.max(-1, Math.min(1, adjustment));
  const hz = effectiveSampleRate / refinedTau;
  if (hz < MIN_PITCH_HZ || hz > MAX_PITCH_HZ) return null;

  return {
    hz,
    clarity: Math.max(0, Math.min(1, 1 - center)),
  };
}

export function noteFromFrequency(
  hz: number,
  a4 = 440,
): { midi: number; name: string; octave: number; cents: number } {
  if (!Number.isFinite(hz) || hz <= 0 || !Number.isFinite(a4) || a4 <= 0) {
    throw new RangeError("Frequency and A4 reference must be positive.");
  }
  const midiFloat = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(midiFloat);
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((midiFloat - midi) * 100),
  };
}

const GUITAR_STRINGS = [
  { name: "E2", midi: 40 },
  { name: "A2", midi: 45 },
  { name: "D3", midi: 50 },
  { name: "G3", midi: 55 },
  { name: "B3", midi: 59 },
  { name: "E4", midi: 64 },
] as const;

export function nearestGuitarString(
  hz: number,
  a4 = 440,
): { name: string; midi: number; cents: number } {
  const note = noteFromFrequency(hz, a4);
  let nearest: (typeof GUITAR_STRINGS)[number] = GUITAR_STRINGS[0];
  for (const string of GUITAR_STRINGS.slice(1)) {
    if (Math.abs(string.midi - note.midi) < Math.abs(nearest.midi - note.midi)) {
      nearest = string;
    }
  }
  return {
    ...nearest,
    cents: Math.round(
      1200 * Math.log2(hz / (a4 * 2 ** ((nearest.midi - 69) / 12))),
    ),
  };
}

export function chromaFromAudio(
  channel: Float32Array,
  sampleRate: number,
): number[] {
  const chroma = Array<number>(12).fill(0);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return chroma;

  const frameSize = 2048;
  const hopSize = 1024;
  const maxSamples = Math.min(channel.length, Math.floor(sampleRate * 600));
  const frame = new Float32Array(frameSize);
  const frameDuration = hopSize / sampleRate;
  for (
    let start = 0;
    start + frameSize <= maxSamples;
    start += hopSize
  ) {
    frame.set(channel.subarray(start, start + frameSize));
    const pitch = detectPitch(frame, sampleRate);
    if (!pitch || pitch.clarity < 0.8) continue;
    const midi = noteFromFrequency(pitch.hz).midi;
    chroma[((midi % 12) + 12) % 12] += frameDuration;
  }
  return chroma;
}

const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
} as const;

function correlation(values: readonly number[], profile: readonly number[]) {
  const valueMean = values.reduce((sum, value) => sum + value, 0) / 12;
  const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
  let numerator = 0;
  let valueVariance = 0;
  let profileVariance = 0;
  for (let index = 0; index < 12; index += 1) {
    const valueDelta = values[index] - valueMean;
    const profileDelta = profile[index] - profileMean;
    numerator += valueDelta * profileDelta;
    valueVariance += valueDelta * valueDelta;
    profileVariance += profileDelta * profileDelta;
  }
  const denominator = Math.sqrt(valueVariance * profileVariance);
  return denominator === 0 ? 0 : numerator / denominator;
}

export function detectKey(
  chroma: number[],
): { root: number; mode: "major" | "minor"; confidence: number; label: string } | null {
  if (chroma.length !== 12) return null;
  const values = chroma.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0,
  );
  if (values.reduce((sum, value) => sum + value, 0) === 0) return null;

  let best: { root: number; mode: "major" | "minor"; score: number } | null = null;
  for (const mode of ["major", "minor"] as const) {
    const profile = KEY_PROFILES[mode];
    for (let root = 0; root < 12; root += 1) {
      const rotated = Array.from(
        { length: 12 },
        (_, pitchClass) => profile[(pitchClass - root + 12) % 12],
      );
      const score = correlation(values, rotated);
      if (!best || score > best.score) best = { root, mode, score };
    }
  }

  if (!best) return null;
  return {
    root: best.root,
    mode: best.mode,
    confidence: Math.max(0, Math.min(1, best.score)),
    label: `${NOTE_NAMES[best.root]} ${best.mode}`,
  };
}
