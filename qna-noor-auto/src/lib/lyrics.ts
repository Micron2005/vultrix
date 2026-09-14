export type LyricLine =
  | { kind: "section"; label: string }
  | { kind: "line"; text: string; syllables: number }
  | { kind: "blank" };

export type LyricMetaLine = { bars?: 1 | 2 | 4 | 8; note?: string };
export type LyricsMeta = { v: 1; lines: Record<string, LyricMetaLine> };

export const LYRIC_SECTIONS = [
  "Intro",
  "Verse 1",
  "Pre-chorus",
  "Hook",
  "Verse 2",
  "Bridge",
  "Outro",
] as const;

export function parseLyricsMeta(raw: string | null): LyricsMeta {
  if (!raw) return { v: 1, lines: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<LyricsMeta>;
    if (parsed.v !== 1 || !parsed.lines || typeof parsed.lines !== "object") {
      return { v: 1, lines: {} };
    }
    return {
      v: 1,
      lines: Object.fromEntries(
        Object.entries(parsed.lines).slice(0, 200).map(([text, value]) => {
          const item = value && typeof value === "object" ? (value as LyricMetaLine) : {};
          return [
            text.trim(),
            {
              ...(item.bars && [1, 2, 4, 8].includes(item.bars) ? { bars: item.bars } : {}),
              ...(typeof item.note === "string" && item.note.trim()
                ? { note: item.note.trim().slice(0, 300) }
                : {}),
            },
          ];
        }),
      ),
    };
  } catch {
    return { v: 1, lines: {} };
  }
}

const syllableOverrides: Record<string, number> = {
  beautiful: 3,
  created: 3,
  rhythm: 2,
};

export function countSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 0;
  if (syllableOverrides[normalized]) return syllableOverrides[normalized];

  const groups = normalized.match(/[aeiouy]+/g)?.length ?? 0;
  if (groups <= 1) return 1;

  const endsWithLe = /[^aeiouy]le$/.test(normalized);
  const endsWithSilentE = /[^le]e$/.test(normalized);
  let syllables = groups;
  if (endsWithSilentE) syllables -= 1;

  if (normalized.endsWith("ed") && !/[td]ed$/.test(normalized)) {
    syllables -= 1;
  }

  if (endsWithLe) syllables = Math.max(syllables, 2);
  return Math.max(1, syllables);
}

export function lineSyllables(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, word) => sum + countSyllables(word), 0);
}

export function parseLyrics(text: string): LyricLine[] {
  return text.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return { kind: "blank" };
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) return { kind: "section", label: section[1].trim() };
    return { kind: "line", text: line, syllables: lineSyllables(line) };
  });
}
