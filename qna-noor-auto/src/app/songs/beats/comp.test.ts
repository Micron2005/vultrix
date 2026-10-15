import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BEAT_DATA } from "./kits";
import type { BeatDocument, BeatTakeAudio } from "./engine";
import {
  autoFillComp,
  compSegments,
  compSlots,
  parseComp,
  windowTake,
} from "./comp";

function documentWithSections(): BeatDocument {
  const first = {
    ...DEFAULT_BEAT_DATA.patterns[0],
    id: "one",
    name: "One bar",
    bars: 1 as const,
  };
  const second = {
    ...DEFAULT_BEAT_DATA.patterns[0],
    id: "two",
    name: "Two bars",
    bars: 2 as const,
  };

  return {
    title: "Comp test",
    bpm: 120,
    swing: 0,
    kit: "Drums",
    data: {
      ...DEFAULT_BEAT_DATA,
      patterns: [first, second],
      sections: [
        {
          id: "intro",
          name: "Intro",
          patternId: first.id,
          repeats: 2,
          mutedTracks: [],
        },
        {
          id: "verse",
          name: "Verse",
          patternId: second.id,
          repeats: 1,
          mutedTracks: [],
        },
      ],
    },
  };
}

function fakeTake(
  overrides: Partial<BeatTakeAudio> = {},
): BeatTakeAudio {
  return {
    buffer: { duration: 10 } as AudioBuffer,
    offsetMs: 500,
    gain: 1,
    pan: 0,
    muted: false,
    trimStartMs: 200,
    trimEndMs: 700,
    fx: {
      reverb: 0,
      eqLow: 0,
      eqHigh: 0,
      compress: false,
      doubler: false,
    },
    ...overrides,
  };
}

test("compSlots expands sections and repeats using bar durations", () => {
  const slots = compSlots(documentWithSections());

  assert.deepEqual(
    slots.map(({ startMs, endMs }) => [startMs, endMs]),
    [
      [0, 2000],
      [2000, 4000],
      [4000, 8000],
    ],
  );
  assert.deepEqual(
    slots.map(({ name }) => name),
    ["Intro ×1", "Intro ×2", "Verse"],
  );
});

test("compSegments merges adjacent assigned slots", () => {
  const slots = compSlots(documentWithSections());
  const comp = {
    v: 1 as const,
    slots: { "0:0": "take-a", "0:1": "take-a", "1:0": "take-b" },
  };

  assert.deepEqual(compSegments(slots, comp, "take-a"), [
    { startMs: 0, endMs: 4000 },
  ]);
});

test("windowTake applies offset-aware trims and fades to partial windows", () => {
  const audio = fakeTake();
  const inside = windowTake(audio, 2000, 6000);
  assert.equal(inside?.trimStartMs, 1500);
  assert.equal(inside?.trimEndMs, 4500);
  assert.equal(inside?.fadeMs, 15);

  const partial = windowTake(audio, 0, 1500);
  assert.equal(partial?.trimStartMs, 200);
  assert.equal(partial?.trimEndMs, 9000);
});

test("windowTake returns null when a window misses the take", () => {
  assert.equal(windowTake(fakeTake(), 11000, 12000), null);
});

test("autoFillComp uses the newest take with at least 80 percent coverage", () => {
  const slots = [
    { key: "0:0", sectionIndex: 0, repeat: 0, name: "A", startMs: 0, endMs: 1000 },
    { key: "0:1", sectionIndex: 0, repeat: 1, name: "B", startMs: 1000, endMs: 2000 },
    { key: "1:0", sectionIndex: 1, repeat: 0, name: "C", startMs: 2000, endMs: 3000 },
    { key: "2:0", sectionIndex: 2, repeat: 0, name: "D", startMs: 5000, endMs: 6000 },
    { key: "3:0", sectionIndex: 3, repeat: 0, name: "E", startMs: 7000, endMs: 8000 },
  ];
  const comp = autoFillComp(slots, [
    {
      id: "old",
      offsetMs: 0,
      trimStartMs: 0,
      trimEndMs: 0,
      durationSec: 4,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "new",
      offsetMs: 0,
      trimStartMs: 0,
      trimEndMs: 0,
      durationSec: 2,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "late",
      offsetMs: 5000,
      trimStartMs: 0,
      trimEndMs: 0,
      durationSec: 1,
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(comp.slots, {
    "0:0": "new",
    "0:1": "new",
    "1:0": "old",
    "2:0": "late",
    "3:0": null,
  });
});

test("parseComp falls back to an empty comp for garbage", () => {
  assert.deepEqual(parseComp("not json"), { v: 1, slots: {} });
});
