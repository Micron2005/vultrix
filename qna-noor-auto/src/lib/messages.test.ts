import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationPair,
  isUnreadFor,
  MESSAGE_MAX,
  normalizeMessageBody,
  previewOf,
} from "./messages";

test("conversationPair sorts profile ids and rejects self-conversations", () => {
  assert.deepEqual(conversationPair("profile_b", "profile_a"), {
    aProfileId: "profile_a",
    bProfileId: "profile_b",
  });
  assert.throws(() => conversationPair("same", "same"));
});

test("normalizes message whitespace without allowing empty or oversized bodies", () => {
  assert.equal(
    normalizeMessageBody("  first\r\nsecond\n\n\n\nthird  "),
    "first\nsecond\n\n\nthird",
  );
  assert.equal(normalizeMessageBody("  \r\n  "), null);
  assert.equal(normalizeMessageBody("x".repeat(MESSAGE_MAX + 1)), null);
});

test("isUnreadFor compares the viewer read time to the latest message", () => {
  const lastMessageAt = new Date("2026-11-07T10:00:00.000Z");
  const conversation = {
    aProfileId: "a",
    aReadAt: null,
    bReadAt: null,
    lastMessageAt,
    lastSenderProfileId: "a",
  };

  assert.equal(isUnreadFor("b", conversation), true);
  assert.equal(isUnreadFor("a", conversation), false);
  assert.equal(
    isUnreadFor("b", { ...conversation, bReadAt: lastMessageAt }),
    false,
  );
  assert.equal(
    isUnreadFor("b", {
      ...conversation,
      bReadAt: new Date(lastMessageAt.getTime() - 1),
    }),
    true,
  );
  assert.equal(
    isUnreadFor("b", {
      ...conversation,
      bReadAt: new Date(lastMessageAt.getTime() + 1),
    }),
    false,
  );
  assert.equal(
    isUnreadFor("b", { ...conversation, lastMessageAt: null }),
    false,
  );
});

test("previewOf is single-line and truncates to 140 characters", () => {
  assert.equal(previewOf(" first\nsecond\tthird "), "first second third");
  const preview = previewOf("x".repeat(141));
  assert.equal(preview, `${"x".repeat(139)}…`);
  assert.equal(Array.from(preview).length, 140);
});
