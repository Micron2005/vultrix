import assert from "node:assert/strict";
import test from "node:test";
import { musicAccess, pickBaseSubscriptionItem } from "./musicAddon";

const now = new Date("2026-01-01T00:00:00.000Z");

test("free accounts always have Music access", () => {
  assert.deepEqual(
    musicAccess(
      {
        billingExempt: true,
        musicAddon: false,
        musicAddonGraceUntil: null,
      },
      now,
    ),
    { allowed: true, reason: "free_account", graceUntil: null },
  );
});

test("an enabled add-on grants Music access", () => {
  assert.deepEqual(
    musicAccess(
      {
        billingExempt: false,
        musicAddon: true,
        musicAddonGraceUntil: null,
      },
      now,
    ),
    { allowed: true, reason: "addon", graceUntil: null },
  );
});

test("future grace grants Music access", () => {
  const graceUntil = new Date("2026-01-02T00:00:00.000Z");
  assert.deepEqual(
    musicAccess(
      { billingExempt: false, musicAddon: false, musicAddonGraceUntil: graceUntil },
      now,
    ),
    { allowed: true, reason: "grace", graceUntil },
  );
});

test("past grace does not grant Music access", () => {
  const graceUntil = new Date("2025-12-31T23:59:59.000Z");
  assert.deepEqual(
    musicAccess(
      { billingExempt: false, musicAddon: false, musicAddonGraceUntil: graceUntil },
      now,
    ),
    { allowed: false, reason: "none", graceUntil },
  );
});

test("accounts without an add-on or grace are locked", () => {
  assert.deepEqual(
    musicAccess(
      {
        billingExempt: false,
        musicAddon: false,
        musicAddonGraceUntil: null,
      },
      now,
    ),
    { allowed: false, reason: "none", graceUntil: null },
  );
});

test("base subscription item selection skips Music add-on items", () => {
  const addon = {
    id: "addon",
    price: { lookup_key: "vultrix_music_addon_10" },
  };
  const base = {
    id: "base",
    price: { lookup_key: "vultrix_monthly_25" },
  };

  assert.equal(pickBaseSubscriptionItem([addon, base]), base);
  assert.equal(pickBaseSubscriptionItem([addon]), undefined);
});
