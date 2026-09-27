import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLegacyKit,
  DEFAULT_BEAT_DATA,
  emptyPattern,
  BeatDataSchema,
} from "./kits";

test("converts legacy beat-level machine kits into machine tracks", () => {
  const data = applyLegacyKit(DEFAULT_BEAT_DATA, "808");
  const drums = data.tracks.find((track) => track.id === "drums");
  assert.equal(drums?.kind, "machine");
  assert.equal(drums?.kit, "808");
});

test("leaves acoustic beat-level kits unchanged", () => {
  assert.equal(applyLegacyKit(DEFAULT_BEAT_DATA, "Drums"), DEFAULT_BEAT_DATA);
});

test("defaults missing track kits when parsing v2 data", () => {
  const parsed = BeatDataSchema.parse({
    ...DEFAULT_BEAT_DATA,
    tracks: DEFAULT_BEAT_DATA.tracks.map((track) => {
      const withoutKit: Partial<typeof track> = { ...track };
      delete withoutKit.kit;
      return withoutKit;
    }),
  });
  assert.ok(parsed.tracks.every((track) => track.kit === "808"));
});

test("creates drum grids for machine tracks", () => {
  const pattern = emptyPattern(
    [{ ...DEFAULT_BEAT_DATA.tracks[0], kind: "machine" }],
    "Machine",
  );
  assert.ok(pattern.drums[DEFAULT_BEAT_DATA.tracks[0].id]);
  assert.ok(pattern.drums[DEFAULT_BEAT_DATA.tracks[0].id].kick);
});
