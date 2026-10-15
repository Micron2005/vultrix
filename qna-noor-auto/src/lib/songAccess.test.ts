import assert from "node:assert/strict";
import test from "node:test";
import { beatAccessWhere, songAccessWhere } from "./songAccess";

test("song access includes owned and shared songs", () => {
  assert.deepEqual(songAccessWhere("org-1"), {
    OR: [{ orgId: "org-1" }, { members: { some: { orgId: "org-1" } } }],
  });
});

test("beat access includes owned beats and beats linked to accessible songs", () => {
  assert.deepEqual(beatAccessWhere("org-1"), {
    OR: [
      { orgId: "org-1" },
      {
        song: {
          OR: [
            { orgId: "org-1" },
            { members: { some: { orgId: "org-1" } } },
          ],
        },
      },
    ],
  });
});
