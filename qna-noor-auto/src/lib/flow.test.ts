import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bestGridForTaps,
  fitCheck,
  flowDurationBeats,
  quantizeTaps,
  splitSyllables,
  suggestPatterns,
} from "./flow";
import { countSyllables } from "./lyrics";

test("fit checks cover density thresholds, two bars, and empty lines", () => {
  assert.deepEqual(fitCheck(0, 1), { verdict: "roomy", message: "No syllables" });
  assert.equal(fitCheck(4, 1).verdict, "roomy");
  assert.match(fitCheck(5, 1).message, /fits as 8th notes/);
  assert.equal(fitCheck(9, 1).verdict, "triplets");
  assert.equal(fitCheck(13, 1).verdict, "16ths");
  assert.match(fitCheck(17, 1).message, /too many for 1 bar/);
  assert.equal(fitCheck(8, 2).verdict, "roomy");
  assert.equal(fitCheck(16, 2).verdict, "8ths");
  assert.equal(fitCheck(24, 2).verdict, "triplets");
  assert.equal(fitCheck(32, 2).verdict, "16ths");
  assert.equal(fitCheck(33, 2).verdict, "too-many");
});

test("syllable chunks preserve visible words and match countSyllables", () => {
  const words = ["the", "city", "believe", "station", "I'm", "beautiful", "rhythm", "created", "fire"];
  const syllables = splitSyllables(words.join(" "));
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const wordSyllables = syllables.filter((syllable) => syllable.word === wordIndex);
    assert.equal(wordSyllables.map((syllable) => syllable.text).join(""), words[wordIndex]);
    assert.equal(wordSyllables.length, countSyllables(words[wordIndex]));
  }
});

test("stress marks function words lightly and multisyllabic stresses", () => {
  assert.equal(splitSyllables("the")[0].stressed, false);
  assert.deepEqual(splitSyllables("city").map((syllable) => syllable.stressed), [true, false]);
  assert.deepEqual(splitSyllables("believe").map((syllable) => syllable.stressed), [false, true]);
  assert.deepEqual(splitSyllables("station").map((syllable) => syllable.stressed), [true, false]);
});

test("patterns fit capacity, preserve order, and place key words on beats", () => {
  const syllables = splitSyllables("I got the keys to the city");
  const patterns = suggestPatterns(syllables, 2);
  assert.ok(patterns.length <= 4);
  for (const pattern of patterns) {
    assert.equal(pattern.flow.hits.length, syllables.length);
    assert.ok(pattern.flow.hits.every((hit, index, hits) =>
      hit >= 0 && hit < pattern.flow.grid * pattern.flow.bars &&
      (index === 0 || hit > hits[index - 1]),
    ));
  }
  const straight = patterns.find((pattern) => pattern.id === "straight");
  assert.ok(straight);
  for (const index of [1, 3, 6]) {
    assert.equal(straight.flow.hits[index] % 2, 0);
  }
  assert.deepEqual(suggestPatterns([], 1), []);
  assert.deepEqual(
    suggestPatterns(splitSyllables("I we me he she you my to the is it a an on in up go"), 1),
    [],
  );
});

test("laid-back patterns begin after the downbeat", () => {
  const laidBack = suggestPatterns(splitSyllables("city lights glow"), 1)
    .find((pattern) => pattern.id === "laid-back");
  assert.ok(laidBack);
  assert.ok(laidBack.flow.hits[0] >= 2);
});

test("tap quantization snaps, pushes collisions forward, and drops out-of-range taps", () => {
  assert.deepEqual(quantizeTaps([0, 0.1, 0.5, 3.9, 4.1], 8, 1), [0, 1, 2, 7]);
  assert.deepEqual(quantizeTaps([0, 0, 0], 8, 1), [0, 1, 2]);
  assert.deepEqual(quantizeTaps([-0.3, -0.2, 4.01], 8, 1), [0]);
});

test("tap grid selection recognizes triplets and prefers eighths for even taps", () => {
  assert.equal(bestGridForTaps([0, 1 / 3, 2 / 3, 1], 1), 12);
  assert.equal(bestGridForTaps([0, 0.5, 1, 1.5], 1), 8);
});

test("flow duration follows one or two bars", () => {
  assert.equal(flowDurationBeats({ grid: 8, bars: 1, hits: [0], source: "tap" }), 4);
  assert.equal(flowDurationBeats({ grid: 16, bars: 2, hits: [0], source: "pattern" }), 8);
});
