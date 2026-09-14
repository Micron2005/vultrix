import assert from "node:assert/strict";
import { test } from "node:test";
import { countSyllables, parseLyrics } from "./lyrics";

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
