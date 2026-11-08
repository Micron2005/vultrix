import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssign,
  normalizeProjectPost,
  normalizeProjectTitle,
  normalizeTaskTitle,
  PROJECT_FILE_MAX_BYTES,
  PROJECT_ORG_MAX,
  validateProjectFile,
} from "./projects";

test("project and task titles normalize whitespace and enforce limits", () => {
  assert.equal(normalizeProjectTitle(" \t "), null);
  assert.equal(normalizeProjectTitle("  Print   the  flyers "), "Print the flyers");
  assert.equal(normalizeProjectTitle("x".repeat(120)), "x".repeat(120));
  assert.equal(normalizeProjectTitle("x".repeat(121)), null);
  assert.equal(normalizeTaskTitle(" \n "), null);
  assert.equal(normalizeTaskTitle("x".repeat(200)), "x".repeat(200));
  assert.equal(normalizeTaskTitle("x".repeat(201)), null);
});

test("project files allow resized JPEG and bounded PDF, rejecting other types", () => {
  assert.equal(validateProjectFile({ mimeType: "image/jpeg", sizeBytes: 1 }), "ok");
  assert.equal(
    validateProjectFile({
      mimeType: "application/pdf",
      sizeBytes: PROJECT_FILE_MAX_BYTES,
    }),
    "ok",
  );
  assert.equal(
    validateProjectFile({
      mimeType: "application/pdf",
      sizeBytes: PROJECT_FILE_MAX_BYTES + 1,
    }),
    "size",
  );
  assert.equal(
    validateProjectFile({ mimeType: "text/html", sizeBytes: 1 }),
    "type",
  );
  assert.equal(
    validateProjectFile({ mimeType: "application/pdf", sizeBytes: 0 }),
    "size",
  );
});

test("project posts normalize line endings and enforce the message limit", () => {
  assert.equal(normalizeProjectPost(" \r\n "), null);
  assert.equal(normalizeProjectPost(" first\r\nsecond "), "first\nsecond");
  assert.equal(normalizeProjectPost("x".repeat(2000)), "x".repeat(2000));
  assert.equal(normalizeProjectPost("x".repeat(2001)), null);
});

test("project member limit and task assignment include the owner and members", () => {
  assert.equal(PROJECT_ORG_MAX, 10);
  const project = { orgId: "owner", memberOrgIds: ["member"] };
  assert.equal(canAssign("owner", project), true);
  assert.equal(canAssign("member", project), true);
  assert.equal(canAssign("outsider", project), false);
});
