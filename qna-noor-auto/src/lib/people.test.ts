import assert from "node:assert/strict";
import test from "node:test";
import {
  groupShareCandidates,
  normalizeHandle,
  normalizeName,
  type ShareCandidate,
} from "./people";

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

test("groups song-share candidates and excludes existing members", () => {
  const mutual = {
    id: "mutual",
    orgId: "mutual-org",
    handle: "mutual",
    displayName: "Mutual",
  };
  const waiting = {
    id: "waiting",
    orgId: "waiting-org",
    handle: "waiting",
    displayName: "Waiting",
  };
  const follower = {
    id: "follower",
    orgId: "follower-org",
    handle: "follower",
    displayName: "Follower",
  };
  const existingMember = {
    id: "member",
    orgId: "member-org",
    handle: "member",
    displayName: "Member",
  };
  const followers: ShareCandidate[] = [
    mutual,
    follower,
    existingMember,
  ];

  const groups = groupShareCandidates(
    [mutual, waiting, existingMember],
    followers,
    new Set(["member-org"]),
  );

  assert.deepEqual(groups.mutual.map((profile) => profile.id), ["mutual"]);
  assert.deepEqual(groups.followingOnly.map((profile) => profile.id), ["waiting"]);
  assert.deepEqual(groups.followersOnly.map((profile) => profile.id), ["follower"]);
});
