import assert from "node:assert/strict";
import test from "node:test";
import { makeToken, tokenNonce } from "./auth";

test("tokenNonce returns the nonce from a valid token", () => {
  const token = makeToken("user-1");

  assert.equal(tokenNonce(token), token.split(".")[2]);
});

test("tokenNonce rejects a tampered signature", () => {
  const token = makeToken("user-1");
  const tampered = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;

  assert.equal(tokenNonce(tampered), null);
});

test("tokenNonce rejects a token with the wrong number of parts", () => {
  const token = makeToken("user-1").split(".").slice(0, 3).join(".");

  assert.equal(tokenNonce(token), null);
});
