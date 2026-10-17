import { countSyllables } from "./lyrics";

export type FlowGrid = 8 | 12 | 16;
export type LineFlow = {
  grid: FlowGrid;
  bars: 1 | 2;
  hits: number[];
  source: "pattern" | "tap";
  label?: string;
};
export type FlowSyllable = { text: string; word: number; stressed: boolean };

const functionWords = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "and", "but", "or", "for",
  "i", "my", "me", "you", "your", "it", "is", "was", "be", "we", "he", "she",
  "they", "them", "that", "this", "with", "from", "as", "so", "if", "im", "its",
]);

function splitWord(word: string): string[] {
  const count = countSyllables(word);
  if (count === 0) return [];
  const vowelRuns: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < word.length;) {
    if (!/[aeiouy]/i.test(word[index])) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < word.length && /[aeiouy]/i.test(word[index])) index += 1;
    vowelRuns.push({ start, end: index });
  }

  const boundaries = vowelRuns.slice(1).map((run, index) => {
    const previous = vowelRuns[index];
    const gap = run.start - previous.end;
    return previous.end + Math.floor(gap / 2);
  }).filter((boundary, index, all) =>
    boundary > (index === 0 ? 0 : all[index - 1]) && boundary < word.length,
  );
  const chunks = [
    boundaries.length ? word.slice(0, boundaries[0]) : word,
    ...boundaries.slice(1).map((boundary, index) => word.slice(boundaries[index], boundary)),
    ...(boundaries.length ? [word.slice(boundaries.at(-1)!)] : []),
  ].filter(Boolean);

  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  while (chunks.length > count) {
    let mergeAt = chunks.length - 2;
    if (normalized.endsWith("e") && chunks.length > 1) mergeAt = chunks.length - 2;
    else {
      for (let index = 0; index < chunks.length - 1; index += 1) {
        if (
          chunks[index].length + chunks[index + 1].length <
          chunks[mergeAt].length + chunks[mergeAt + 1].length
        ) {
          mergeAt = index;
        }
      }
    }
    chunks.splice(mergeAt, 2, chunks[mergeAt] + chunks[mergeAt + 1]);
  }
  while (chunks.length < count) {
    let splitAt = 0;
    for (let index = 1; index < chunks.length; index += 1) {
      if (chunks[index].length > chunks[splitAt].length) splitAt = index;
    }
    const chunk = chunks[splitAt];
    const middle = Math.max(1, Math.floor(chunk.length / 2));
    chunks.splice(splitAt, 1, chunk.slice(0, middle), chunk.slice(middle));
  }
  return chunks;
}

function stressedSyllableIndex(word: string, chunks: string[]): number {
  if (chunks.length <= 1) {
    return functionWords.has(word.toLowerCase().replace(/[^a-z']/g, "").replace("'", ""))
      ? -1
      : 0;
  }

  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  const ending = ["tion", "sion", "ic"].find((suffix) => normalized.endsWith(suffix));
  if (ending) {
    const positions: number[] = [];
    for (let index = 0; index < word.length; index += 1) {
      if (/[a-z]/i.test(word[index])) positions.push(index);
    }
    const stressPosition = positions[Math.max(0, positions.length - ending.length - 1)];
    let offset = 0;
    return chunks.findIndex((chunk) => {
      const includes = stressPosition >= offset && stressPosition < offset + chunk.length;
      offset += chunk.length;
      return includes;
    });
  }
  const prefix = ["be", "re", "de", "a", "un", "pre", "for"]
    .find((item) => normalized.startsWith(item));
  if (normalized.length > 4 && prefix) return 1;
  return 0;
}

export function splitSyllables(line: string): FlowSyllable[] {
  const result: FlowSyllable[] = [];
  const words = line.match(/\S+/g) ?? [];
  words.forEach((word, wordIndex) => {
    const chunks = splitWord(word);
    const stressed = stressedSyllableIndex(word, chunks);
    chunks.forEach((text, index) => {
      result.push({ text, word: wordIndex, stressed: index === stressed });
    });
  });
  return result;
}

export function fitCheck(
  syllables: number,
  bars: 1 | 2,
): { verdict: "roomy" | "8ths" | "triplets" | "16ths" | "too-many"; message: string } {
  if (syllables <= 0) return { verdict: "roomy", message: "No syllables" };
  const density = syllables / bars;
  if (density <= 4) {
    return {
      verdict: "roomy",
      message: `${syllables} syllables: slow and spaced — quarter notes, room to breathe`,
    };
  }
  if (density <= 8) {
    return { verdict: "8ths", message: `${syllables} syllables: fits as 8th notes` };
  }
  if (density <= 12) {
    return { verdict: "triplets", message: `${syllables} syllables: fits as triplets` };
  }
  if (density <= 16) {
    return { verdict: "16ths", message: `${syllables} syllables: fits as 16th notes — double-time` };
  }
  return {
    verdict: "too-many",
    message: `too many for ${bars} bar${bars === 1 ? "" : "s"}: split the line or use 2 bars`,
  };
}

function slotCost(syllable: FlowSyllable, slot: number, grid: FlowGrid) {
  let cost = 0;
  if (syllable.stressed && slot % (grid / 4) !== 0) cost += 2;
  if (syllable.stressed && grid === 16 && slot % 2 === 1) cost += 1;
  if (!syllable.stressed && slot % grid === 0) cost += 1;
  return cost;
}

function placeSyllables(
  syllables: FlowSyllable[],
  grid: FlowGrid,
  bars: 1 | 2,
  firstSlot = 0,
): number[] | null {
  const totalSlots = grid * bars;
  const candidates = Array.from(
    { length: totalSlots - firstSlot },
    (_, index) => firstSlot + index,
  );
  const count = syllables.length;
  if (!count || count > candidates.length) return null;

  const idealGap = candidates.length / count;
  const costs = Array.from({ length: count }, () => Array(totalSlots).fill(Infinity) as number[]);
  const previous = Array.from({ length: count }, () =>
    Array(totalSlots).fill(-1) as number[],
  );
  for (const slot of candidates) costs[0][slot] = slotCost(syllables[0], slot, grid);

  for (let index = 1; index < count; index += 1) {
    for (const slot of candidates) {
      for (const prior of candidates) {
        if (prior >= slot || !Number.isFinite(costs[index - 1][prior])) continue;
        const gapCost = Math.abs(slot - prior - idealGap) * 0.5;
        const cost = costs[index - 1][prior] + gapCost + slotCost(syllables[index], slot, grid);
        if (cost < costs[index][slot]) {
          costs[index][slot] = cost;
          previous[index][slot] = prior;
        }
      }
    }
  }

  let last = -1;
  let bestCost = Infinity;
  for (const slot of candidates) {
    if (costs[count - 1][slot] < bestCost) {
      bestCost = costs[count - 1][slot];
      last = slot;
    }
  }
  if (last < 0) return null;
  const hits = Array(count);
  for (let index = count - 1; index >= 0; index -= 1) {
    hits[index] = last;
    last = previous[index][last];
  }
  return hits;
}

export function suggestPatterns(
  syls: FlowSyllable[],
  bars: 1 | 2,
): { id: string; label: string; flow: LineFlow }[] {
  if (!syls.length) return [];
  const patterns = [
    { id: "straight", label: "Straight", grid: 8 as const, firstSlot: 0 },
    { id: "double-time", label: "Double-time", grid: 16 as const, firstSlot: 0 },
    { id: "triplet", label: "Triplet", grid: 12 as const, firstSlot: 0 },
    { id: "laid-back", label: "Laid-back", grid: 16 as const, firstSlot: 2 },
  ];
  return patterns.flatMap(({ id, label, grid, firstSlot }) => {
    if (syls.length > grid * bars) return [];
    const hits = placeSyllables(syls, grid, bars, firstSlot);
    if (!hits) return [];
    return [{ id, label, flow: { grid, bars, hits, source: "pattern", label } }];
  });
}

export function quantizeTaps(tapBeats: number[], grid: FlowGrid, bars: 1 | 2): number[] {
  const totalSlots = grid * bars;
  const slotBeats = 4 / grid;
  const used = new Set<number>();
  const result: number[] = [];
  for (const beat of tapBeats) {
    if (!Number.isFinite(beat) || beat < -slotBeats / 2 || beat > bars * 4) continue;
    let slot = Math.max(0, Math.min(totalSlots - 1, Math.round((beat * grid) / 4)));
    while (used.has(slot) && slot < totalSlots) slot += 1;
    if (slot >= totalSlots) continue;
    used.add(slot);
    result.push(slot);
  }
  return result;
}

function snappingError(tapBeats: number[], grid: FlowGrid, bars: 1 | 2): number {
  const totalSlots = grid * bars;
  const slotBeats = 4 / grid;
  const used = new Set<number>();
  let error = 0;
  for (const beat of tapBeats) {
    if (!Number.isFinite(beat) || beat < -slotBeats / 2 || beat > bars * 4) continue;
    let slot = Math.max(0, Math.min(totalSlots - 1, Math.round((beat * grid) / 4)));
    while (used.has(slot) && slot < totalSlots) slot += 1;
    if (slot >= totalSlots) continue;
    used.add(slot);
    error += Math.abs(beat - slot * slotBeats);
  }
  return error;
}

export function bestGridForTaps(tapBeats: number[], bars: 1 | 2): FlowGrid {
  const grids: FlowGrid[] = [8, 12, 16];
  const errors = new Map(grids.map((grid) => [grid, snappingError(tapBeats, grid, bars)]));
  const best = grids.reduce((chosen, grid) =>
    errors.get(grid)! < errors.get(chosen)! ? grid : chosen,
  );
  const bestError = errors.get(best)!;
  const eighthError = errors.get(8)!;
  if (best === 16 && eighthError <= bestError * 1.1 + 1e-9) return 8;
  return best;
}

export function flowDurationBeats(flow: LineFlow): number {
  return flow.bars * 4;
}
