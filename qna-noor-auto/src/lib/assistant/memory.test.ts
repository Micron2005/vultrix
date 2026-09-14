import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMemoriesForPrompt,
  validateMemoryContent,
} from "./memory";

test("rejects password secrets", () => {
  assert.throws(
    () => validateMemoryContent("my password is hunter2"),
    /I don't store passwords, keys or card numbers\./,
  );
});

test("rejects card numbers", () => {
  assert.throws(
    () => validateMemoryContent("card 4111111111111111"),
    /I don't store passwords, keys or card numbers\./,
  );
});

test("accepts ordinary preferences", () => {
  assert.equal(
    validateMemoryContent("I produce trap at 140 BPM"),
    "I produce trap at 140 BPM",
  );
});

test("formats memories newest last", () => {
  assert.equal(
    formatMemoriesForPrompt([
      { category: "fact", content: "Lives in Austin" },
      { category: "preference", content: "Produces trap around 140 BPM" },
    ]),
    "- [fact] Lives in Austin\n- [preference] Produces trap around 140 BPM",
  );
});
