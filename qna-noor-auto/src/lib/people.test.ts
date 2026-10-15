import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHandle, normalizeName } from "./people";

test("normalizes handles and strips one leading at-sign", () => {
  assert.equal(normalizeHandle("  @Alex_42 "), "alex_42");
});

test("rejects handles outside the allowed length and characters", () => {
  assert.equal(normalizeHandle("@ab"), null);
  assert.equal(normalizeHandle("a".repeat(31)), null);
  assert.equal(normalizeHandle("@name-here"), null);
});

test("normalizes names by trimming, collapsing whitespace, and lowercasing", () => {
  assert.equal(normalizeName("  Alex\t  Smith  "), "alex smith");
});
