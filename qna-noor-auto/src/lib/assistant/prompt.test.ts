import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantSystemPrompt } from "./prompt";

test("builds memory and Music prompt blocks together", () => {
  const prompt = buildAssistantSystemPrompt({
    assistantName: "Nova",
    timezone: "UTC",
    now: new Date("2026-09-12T12:00:00.000Z"),
    accountType: "PERSONAL",
    memories: [{ category: "fact", content: "Produces trap at 140 BPM" }],
    musicEnabled: true,
  });
  assert.match(prompt, /What you remember about this user/);
  assert.match(prompt, /- \[fact\] Produces trap at 140 BPM/);
  assert.match(prompt, /Music pack is on/);
});
