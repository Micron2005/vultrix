import assert from "node:assert/strict";
import test from "node:test";
import { firstResultState } from "./firstResult";

test("business owners see the first-invoice banner until an invoice exists", () => {
  const input = {
    accountType: "BUSINESS",
    features: ["invoices"],
    repairOrderCount: 0,
    checkOffCount: 0,
    dismissed: false,
    role: "OWNER",
  };
  assert.deepEqual(firstResultState(input), {
    kind: "invoice",
    done: false,
    showBanner: true,
  });
  assert.deepEqual(firstResultState({ ...input, repairOrderCount: 1 }), {
    kind: "invoice",
    done: true,
    showBanner: false,
  });
});

test("business accounts without invoices have no first-result flow", () => {
  assert.equal(
    firstResultState({
      accountType: "BUSINESS",
      features: [],
      repairOrderCount: 0,
      checkOffCount: 0,
      dismissed: false,
      role: "ADMIN",
    }),
    null,
  );
});

test("personal owners see the first-routine banner until a check-off exists", () => {
  const input = {
    accountType: "PERSONAL",
    features: [],
    repairOrderCount: 0,
    checkOffCount: 0,
    dismissed: false,
    role: "OWNER",
  };
  assert.deepEqual(firstResultState(input), {
    kind: "routine",
    done: false,
    showBanner: true,
  });
  assert.deepEqual(firstResultState({ ...input, checkOffCount: 1 }), {
    kind: "routine",
    done: true,
    showBanner: false,
  });
});

test("onboarding dismissal completes the personal first-result flow", () => {
  assert.deepEqual(
    firstResultState({
      accountType: "PERSONAL",
      features: [],
      repairOrderCount: 0,
      checkOffCount: 0,
      dismissed: true,
      role: "ADMIN",
    }),
    { kind: "routine", done: true, showBanner: false },
  );
});

test("dismissing business onboarding hides its banner without marking the invoice done", () => {
  assert.deepEqual(
    firstResultState({
      accountType: "BUSINESS",
      features: ["invoices"],
      repairOrderCount: 0,
      checkOffCount: 0,
      dismissed: true,
      role: "OWNER",
    }),
    { kind: "invoice", done: false, showBanner: false },
  );
});

test("auto-shop accounts and staff have no first-result banner", () => {
  assert.equal(
    firstResultState({
      accountType: "AUTO_SHOP",
      features: ["invoices"],
      repairOrderCount: 0,
      checkOffCount: 0,
      dismissed: false,
      role: "OWNER",
    }),
    null,
  );
  assert.equal(
    firstResultState({
      accountType: "PERSONAL",
      features: [],
      repairOrderCount: 0,
      checkOffCount: 0,
      dismissed: false,
      role: "STAFF",
    }),
    null,
  );
});
