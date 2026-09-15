import type { BeatScale, BeatNote } from "./kits";

export const SCALE_INTERVALS: Record<BeatScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteInKey(note: number, key: { root: number; scale: BeatScale } | undefined) {
  if (!key) return true;
  return SCALE_INTERVALS[key.scale].includes((note - key.root + 120) % 12);
}

export function chordNotes(root: number, key: { root: number; scale: BeatScale } | undefined) {
  const intervals = SCALE_INTERVALS[key?.scale ?? "major"];
  const rootPitch = key ? key.root : root % 12;
  const degree = intervals.findIndex((interval) => interval === (root % 12 - rootPitch + 12) % 12);
  const index = degree >= 0 ? degree : 0;
  const pitches = [index, index + 2, index + 4].map((offset) => {
    const octave = Math.floor(offset / intervals.length);
    return root + intervals[offset % intervals.length] - intervals[index] + octave * 12;
  });
  return [...new Set(pitches)].filter((pitch) => pitch >= 24 && pitch <= 96);
}

export type Progression = {
  id: string;
  name: string;
  degrees: number[];
  mood: "happy" | "sad" | "chill" | "dark" | "jazzy";
};

const MAJOR_PROGRESSIONS: Progression[] = [
  { id: "major-pop", name: "I–V–vi–IV", degrees: [0, 4, 5, 3], mood: "happy" },
  { id: "major-chill", name: "vi–IV–I–V", degrees: [5, 3, 0, 4], mood: "chill" },
  { id: "major-fifties", name: "I–vi–IV–V", degrees: [0, 5, 3, 4], mood: "happy" },
  { id: "major-rotate", name: "IV–I–V–vi", degrees: [3, 0, 4, 5], mood: "chill" },
  { id: "major-jazzy", name: "ii–V–I–I", degrees: [1, 4, 0, 0], mood: "jazzy" },
  { id: "major-rock", name: "I–IV–V–IV", degrees: [0, 3, 4, 3], mood: "happy" },
  { id: "major-dreamy", name: "I–iii–vi–IV", degrees: [0, 2, 5, 3], mood: "chill" },
  { id: "major-anthem", name: "I–V–IV–IV", degrees: [0, 4, 3, 3], mood: "happy" },
];

const MINOR_PROGRESSIONS: Progression[] = [
  { id: "minor-sad", name: "i–VI–III–VII", degrees: [0, 5, 2, 6], mood: "sad" },
  { id: "minor-dark", name: "i–iv–v–i", degrees: [0, 3, 4, 0], mood: "dark" },
  { id: "minor-pulse", name: "i–VII–VI–VII", degrees: [0, 6, 5, 6], mood: "dark" },
  { id: "minor-soul", name: "i–iv–VII–III", degrees: [0, 3, 6, 2], mood: "sad" },
  { id: "minor-night", name: "i–VI–VII–i", degrees: [0, 5, 6, 0], mood: "dark" },
  { id: "minor-jazzy", name: "ii°–V–i–i", degrees: [1, 4, 0, 0], mood: "jazzy" },
  { id: "minor-lift", name: "i–III–VII–VI", degrees: [0, 2, 6, 5], mood: "sad" },
  { id: "minor-road", name: "i–v–VI–IV", degrees: [0, 4, 5, 3], mood: "dark" },
];

export const PROGRESSIONS: Progression[] = [...MAJOR_PROGRESSIONS, ...MINOR_PROGRESSIONS];

export function progressionsFor(scale: BeatScale) {
  return scale === "minor" || scale === "dorian" || scale === "blues"
    ? MINOR_PROGRESSIONS
    : MAJOR_PROGRESSIONS;
}

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];

function minorScale(scale: BeatScale) {
  return scale === "minor" || scale === "dorian" || scale === "blues";
}

function degreeQuality(degree: number, scale: BeatScale) {
  const index = ((degree % 7) + 7) % 7;
  if (minorScale(scale)) {
    if (scale === "dorian") {
      return ["minor", "minor", "major", "major", "minor", "diminished", "major"][index];
    }
    return ["minor", "diminished", "major", "minor", "minor", "major", "major"][index];
  }
  return ["major", "minor", "minor", "major", "major", "minor", "diminished"][index];
}

export function degreeLabel(degree: number, scale: BeatScale) {
  const index = ((degree % 7) + 7) % 7;
  const quality = degreeQuality(index, scale);
  const roman = ROMANS[index];
  return quality === "diminished" ? `${roman.toLowerCase()}°` : quality === "minor" ? roman.toLowerCase() : roman;
}

function normalizeVoicing(notes: number[], octave: number) {
  const result = [...notes];
  while (result[0] < octave) {
    for (let index = 0; index < result.length; index += 1) result[index] += 12;
  }
  while (result[0] > octave + 12) {
    for (let index = 0; index < result.length; index += 1) result[index] -= 12;
  }
  while (result[result.length - 1] > octave + 19) {
    result[result.length - 1] -= 12;
    result.sort((a, b) => a - b);
  }
  return result;
}

export type Voicing = "triads" | "sevenths" | "power";

export function chordForDegree(
  root: number,
  scale: BeatScale,
  degree: number,
  octave: number,
  voicing: Voicing,
) {
  if (voicing === "power") {
    return normalizeVoicing([octave + root, octave + root + 7, octave + root + 12], octave);
  }
  const intervals = SCALE_INTERVALS[scale];
  const count = voicing === "sevenths" ? 4 : 3;
  const notes = Array.from({ length: count }, (_, offset) => {
    const index = degree + offset * 2;
    return octave + root + intervals[index % intervals.length] + Math.floor(index / intervals.length) * 12;
  });
  return normalizeVoicing(notes, octave);
}

export function chordName(root: number, scale: BeatScale, degree: number, voicing: Voicing) {
  const intervals = SCALE_INTERVALS[scale];
  const pitch = (root + intervals[((degree % intervals.length) + intervals.length) % intervals.length]) % 12;
  const quality = degreeQuality(degree, scale);
  if (voicing === "power") return `${KEY_NAMES[pitch]}5`;
  if (voicing === "sevenths") {
    const suffix = quality === "major"
      ? (degree === 4 ? "7" : "maj7")
      : quality === "minor" ? "m7" : "dim7";
    return `${KEY_NAMES[pitch]}${suffix}`;
  }
  return `${KEY_NAMES[pitch]}${quality === "minor" ? "m" : quality === "diminished" ? "dim" : ""}`;
}

export type Rhythm = "bar" | "half" | "quarter" | "stab";

export function chordEvents(
  bars: 1 | 2 | 4,
  chordCount: number,
  rhythm: Rhythm,
) {
  if (chordCount <= 0) return [];
  const totalSteps = bars * 16;
  const span = Math.max(1, Math.floor(totalSteps / chordCount));
  const events: Array<{ step: number; len: number; chordIndex: number }> = [];
  for (let chordIndex = 0; chordIndex < chordCount; chordIndex += 1) {
    const start = chordIndex * span;
    const length = chordIndex === chordCount - 1 ? totalSteps - start : span;
    if (rhythm === "bar") {
      events.push({ step: start, len: length, chordIndex });
      continue;
    }
    if (rhythm === "stab" && length >= 8) {
      for (const offset of [0, 6, 10]) {
        if (offset < length) events.push({ step: start + offset, len: 2, chordIndex });
      }
      continue;
    }
    const hits = rhythm === "half" ? 2 : rhythm === "quarter" ? 4 : 2;
    const hitLength = Math.max(1, Math.floor(length / hits));
    for (let hit = 0; hit < hits; hit += 1) {
      const step = start + hit * hitLength;
      if (step < start + length) events.push({ step, len: hitLength, chordIndex });
    }
  }
  return events;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedChoice<T>(items: T[], random: () => number, weight: (item: T) => number) {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let point = random() * total;
  for (const item of items) {
    point -= weight(item);
    if (point <= 0) return item;
  }
  return items[items.length - 1];
}

export function melodyFor(opts: {
  root: number;
  scale: BeatScale;
  degrees: number[];
  bars: 1 | 2 | 4;
  octave: number;
  seed: number;
  density: "sparse" | "medium" | "busy";
}): BeatNote[] {
  const random = mulberry32(opts.seed);
  const totalSteps = opts.bars * 16;
  const intervals = SCALE_INTERVALS[opts.scale];
  const chordCount = Math.max(1, opts.degrees.length);
  const span = Math.max(1, Math.floor(totalSteps / chordCount));
  const notes: BeatNote[] = [];
  const usedNotes: number[] = [];
  const scaleNotes = Array.from({ length: 17 }, (_, index) => {
    const octaveOffset = Math.floor(index / intervals.length);
    return opts.octave + intervals[index % intervals.length] + octaveOffset * 12;
  });
  const densityStep = opts.density === "sparse" ? 4 : opts.density === "medium" ? 2 : 1;

  const chordAt = (index: number) =>
    chordForDegree(opts.root, opts.scale, opts.degrees[index % chordCount], opts.octave, "triads")
      .filter((note) => note >= opts.octave && note <= opts.octave + 16);

  for (let chordIndex = 0; chordIndex < chordCount; chordIndex += 1) {
    const spanStart = chordIndex * span;
    const spanEnd = chordIndex === chordCount - 1 ? totalSteps : Math.min(totalSteps, spanStart + span);
    const chordTones = chordAt(chordIndex);
    for (let step = spanStart; step < spanEnd; step += densityStep) {
      const isStart = step === spanStart;
      const isLast = step + densityStep >= spanEnd && chordIndex === chordCount - 1;
      if (!isStart && opts.density === "busy" && random() < 0.2) continue;
      const previous = usedNotes[usedNotes.length - 1] ?? chordTones[0];
      let note: number;
      if (isStart || isLast) {
        const finalTones = isLast ? chordAt(chordCount - 1).filter((item) => item === chordAt(chordCount - 1)[0] || item === chordAt(chordCount - 1)[2]) : chordTones;
        note = finalTones[Math.floor(random() * finalTones.length)] ?? chordTones[0];
      } else {
        const candidates = scaleNotes.filter((item) => Math.abs(item - previous) <= 9);
        note = weightedChoice(candidates, random, (item) => Math.abs(item - previous) <= 4 ? 3 : 1);
      }
      if (usedNotes.length >= 2 && usedNotes.at(-1) === note && usedNotes.at(-2) === note) {
        const alternative = scaleNotes.find((item) => item !== note && Math.abs(item - previous) <= 9);
        if (alternative !== undefined) note = alternative;
      }
      usedNotes.push(note);
      const nextStep = Math.min(spanEnd, step + (opts.density === "sparse" ? 2 + Math.floor(random() * 3) : opts.density === "medium" ? 1 + Math.floor(random() * 2) : 1));
      notes.push({
        step,
        note,
        len: isLast ? Math.max(1, spanEnd - step) : Math.max(1, nextStep - step),
        vel: isStart ? 1 : step % 4 === 0 ? 0.8 : 0.6,
      });
    }
  }
  return notes;
}
