import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ORG_ID } from "./demoIds";
import {
  collectRecipients,
  unsubscribeToken,
  verifyUnsubscribeToken,
  type AnnouncementOrg,
} from "./announcements";
import { announcementEmailHtml } from "./announcementEmail";

function org(
  id: string,
  values: Partial<Omit<AnnouncementOrg, "id">> = {},
): AnnouncementOrg {
  return {
    id,
    announcementsOptOut: false,
    billingEmail: null,
    users: [],
    ...values,
  };
}

test("collectRecipients deduplicates normalized owner emails across organizations", () => {
  assert.deepEqual(
    collectRecipients([
      org("org-a", {
        users: [{ role: "OWNER", email: " Owner@Example.com " }],
      }),
      org("org-b", {
        users: [{ role: "OWNER", email: "owner@example.com" }],
      }),
    ]),
    [{ orgId: "org-a", email: "owner@example.com" }],
  );
});

test("collectRecipients falls back to billing email when no valid owner email exists", () => {
  assert.deepEqual(
    collectRecipients([
      org("org-a", {
        billingEmail: " Billing@Example.com ",
        users: [{ role: "OWNER", email: null }],
      }),
    ]),
    [{ orgId: "org-a", email: "billing@example.com" }],
  );
});

test("collectRecipients excludes opted-out and demo organizations", () => {
  assert.deepEqual(
    collectRecipients([
      org("opted-out", {
        announcementsOptOut: true,
        billingEmail: "owner@example.com",
      }),
      org(DEMO_ORG_ID, {
        billingEmail: "demo@example.com",
      }),
      org("included", { billingEmail: "in@example.com" }),
    ]),
    [{ orgId: "included", email: "in@example.com" }],
  );
});

test("collectRecipients ignores invalid addresses and non-owner emails", () => {
  assert.deepEqual(
    collectRecipients([
      org("org-a", {
        billingEmail: "also-invalid",
        users: [
          { role: "OWNER", email: "not-an-email" },
          { role: "STAFF", email: "staff@example.com" },
        ],
      }),
    ]),
    [],
  );
});

test("unsubscribe tokens are base64url HMAC values verified in constant time", (t) => {
  const previousIntakeSecret = process.env.INTAKE_SIGNING_SECRET;
  const previousStockSecret = process.env.STOCK_SCAN_SIGNING_SECRET;
  process.env.INTAKE_SIGNING_SECRET = "announcement-test-secret";
  delete process.env.STOCK_SCAN_SIGNING_SECRET;
  t.after(() => {
    if (previousIntakeSecret === undefined) {
      delete process.env.INTAKE_SIGNING_SECRET;
    } else {
      process.env.INTAKE_SIGNING_SECRET = previousIntakeSecret;
    }
    if (previousStockSecret === undefined) {
      delete process.env.STOCK_SCAN_SIGNING_SECRET;
    } else {
      process.env.STOCK_SCAN_SIGNING_SECRET = previousStockSecret;
    }
  });

  const token = unsubscribeToken("org-a");
  assert.ok(token);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(verifyUnsubscribeToken("org-a", token), true);
  assert.equal(verifyUnsubscribeToken("org-b", token), false);
  assert.equal(verifyUnsubscribeToken("org-a", `${token}x`), false);
});

test("announcement HTML escapes body text and formats paragraphs and line breaks", () => {
  const html = announcementEmailHtml(
    "First <script>&\nsecond line\n\nSecond paragraph",
    "https://vultrix.net/unsubscribe?o=org&t=token",
  );
  assert.match(html, /First &lt;script&gt;&amp;<br>second line/);
  assert.match(html, /<\/p><p style="margin:0 0 16px">Second paragraph/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, />Open Vultrix<\/a>/);
  assert.match(html, /You&apos;re getting this|You're getting this/);
  assert.match(html, /Unsubscribe from announcements/);
});
