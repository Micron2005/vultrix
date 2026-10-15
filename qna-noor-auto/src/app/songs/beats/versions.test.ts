import assert from "node:assert/strict";
import test from "node:test";
import { autoVersionsToPrune, nextVersionName } from "./versions";

test("names manual versions by the existing count", () => {
  assert.equal(nextVersionName(0), "Version 1");
  assert.equal(nextVersionName(4), "Version 5");
});

test("prunes auto versions older than the newest kept", () => {
  const versions = Array.from({ length: 12 }, (_, index) => ({
    id: `v${index}`,
    createdAt: new Date(2026, 0, index + 1),
  }));
  assert.deepEqual(autoVersionsToPrune(versions, 10), ["v1", "v0"]);
});
