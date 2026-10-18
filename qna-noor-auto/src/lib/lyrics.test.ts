import assert from "node:assert/strict";
import { test } from "node:test";
import { countSyllables, LyricsMetaSchema, parseLyrics, parseLyricsMeta } from "./lyrics";

test("counts common lyric word syllables", () => {
  assert.equal(countSyllables("fire"), 1);
  assert.equal(countSyllables("able"), 2);
  assert.equal(countSyllables("cake"), 1);
  assert.equal(countSyllables("created"), 3);
  assert.equal(countSyllables("rhythm"), 2);
  assert.equal(countSyllables("beautiful"), 3);
  assert.equal(countSyllables("the"), 1);
  assert.ok([2, 3].includes(countSyllables("every")));
});

test("parses sections, blank lines, and lyric lines", () => {
  assert.deepEqual(parseLyrics("[Verse 1]\nfire in the night\n\n[Hook]"), [
    { kind: "section", label: "Verse 1" },
    { kind: "line", text: "fire in the night", syllables: 4 },
    { kind: "blank" },
    { kind: "section", label: "Hook" },
  ]);
});

test("lyrics metadata preserves valid flows and drops invalid flows", () => {
  const valid = {
    grid: 8,
    bars: 1,
    hits: [0, 2, 7],
    source: "pattern",
    label: "Straight",
  };
  const raw = JSON.stringify({
    v: 1,
    lines: {
      "keep me": { bars: 1, note: "note", flow: valid },
      "drop me": { note: "still here", flow: { ...valid, hits: [2, 2] } },
    },
  });
  const parsed = parseLyricsMeta(raw);
  assert.deepEqual(parsed.lines["keep me"], { bars: 1, note: "note", flow: valid });
  assert.deepEqual(parsed.lines["drop me"], { note: "still here" });
  assert.equal(
    LyricsMetaSchema.safeParse({
      v: 1,
      lines: { invalid: { flow: { ...valid, hits: [8] } } },
    }).success,
    false,
  );
});
