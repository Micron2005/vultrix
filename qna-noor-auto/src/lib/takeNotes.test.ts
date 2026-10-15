import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClock,
  hasExactlyOneTakeId,
  parseClock,
  takeTargetIds,
} from "./takeNotes";

test("parses and formats take timestamps", () => {
  assert.equal(parseClock("1:32"), 92_000);
  assert.equal(parseClock("1:60"), null);
  assert.equal(formatClock(92_999), "1:32");
});

test("take note target has exactly one take foreign key", () => {
  assert.deepEqual(takeTargetIds("song", "song-take"), {
    songTakeId: "song-take",
    beatTakeId: null,
  });
  assert.deepEqual(takeTargetIds("beat", "beat-take"), {
    songTakeId: null,
    beatTakeId: "beat-take",
  });
  assert.equal(
    hasExactlyOneTakeId({ songTakeId: "song-take", beatTakeId: null }),
    true,
  );
  assert.equal(
    hasExactlyOneTakeId({ songTakeId: null, beatTakeId: "beat-take" }),
    true,
  );
  assert.equal(hasExactlyOneTakeId({ songTakeId: null, beatTakeId: null }), false);
  assert.equal(
    hasExactlyOneTakeId({ songTakeId: "song-take", beatTakeId: "beat-take" }),
    false,
  );
});
