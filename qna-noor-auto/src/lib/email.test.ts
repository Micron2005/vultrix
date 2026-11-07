import assert from "node:assert/strict";
import test from "node:test";
import { resendErrorDetail } from "./email";

test("resendErrorDetail includes structured Resend errors", () => {
  assert.equal(
    resendErrorDetail(
      401,
      JSON.stringify({
        name: "validation_error",
        message: "API key is invalid",
      }),
    ),
    "Resend 401 (validation_error): API key is invalid",
  );
});

test("resendErrorDetail includes trimmed plain-text errors", () => {
  assert.equal(
    resendErrorDetail(500, "  Service temporarily unavailable \n"),
    "Resend 500: Service temporarily unavailable",
  );
});

test("resendErrorDetail omits the colon for an empty body", () => {
  assert.equal(resendErrorDetail(502, "  \n"), "Resend 502");
});

test("resendErrorDetail truncates long errors to 500 characters", () => {
  assert.equal(resendErrorDetail(500, "x".repeat(1000)).length, 500);
});
