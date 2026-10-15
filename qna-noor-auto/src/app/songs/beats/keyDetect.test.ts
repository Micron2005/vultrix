import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BEAT_DATA } from "./kits";
import { beatChroma } from "./keyDetect";

test("sums melodic notes across patterns and ignores percussion", () => {
  const pattern = DEFAULT_BEAT_DATA.patterns[0];
  const data = {
    ...DEFAULT_BEAT_DATA,
    patterns: [0, 1].map((index) => ({
      ...pattern,
      id: index === 0 ? pattern.id : "second",
      notes: {
        ...pattern.notes,
        bass: index === 0
          ? [{ step: 0, note: 45, len: 2, vel: 0.5 }]
          : [{ step: 1, note: 52, len: 3, vel: 1 }],
        drums: [{ step: 0, note: 60, len: 16, vel: 1 }],
      },
    })),
  };
  const chroma = beatChroma(data);
  assert.equal(chroma[9], 1);
  assert.equal(chroma[4], 3);
  assert.equal(chroma[0], 0);
});

test("returns empty chroma when patterns have no melodic notes", () => {
  const data = {
    ...DEFAULT_BEAT_DATA,
    patterns: DEFAULT_BEAT_DATA.patterns.map((pattern) => ({
      ...pattern,
      notes: { ...pattern.notes, bass: [], piano: [] },
    })),
  };
  assert.deepEqual(beatChroma(data), Array<number>(12).fill(0));
});
