import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateInTimeZone,
  personalCalendarRange,
} from "./timezone";

test("personal calendar day range includes events in the local day", () => {
  const range = personalCalendarRange(
    "day",
    "2026-05-12",
    "America/New_York",
  );
  assert.equal(range.start.toISOString(), "2026-05-12T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-05-13T04:00:00.000Z");

  const event = new Date("2026-05-13T01:00:00.000Z");
  assert.ok(event >= range.start && event < range.end);
});

test("personal calendar month range starts Monday and spans 42 days", () => {
  const range = personalCalendarRange(
    "month",
    "2026-05-12",
    "America/New_York",
  );
  assert.equal(range.start.toISOString(), "2026-04-27T04:00:00.000Z");
  assert.equal(range.end.getTime() - range.start.getTime(), 42 * 24 * 60 * 60 * 1000);
});

test("personal calendar week range starts Monday", () => {
  const range = personalCalendarRange(
    "week",
    "2026-05-12",
    "America/New_York",
  );
  assert.equal(range.start.toISOString(), "2026-05-11T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-05-18T04:00:00.000Z");
});

test("personal calendar year range uses local midnight across DST", () => {
  const range = personalCalendarRange(
    "year",
    "2026-05-12",
    "America/New_York",
  );
  assert.equal(range.start.toISOString(), "2026-01-01T05:00:00.000Z");
  assert.equal(range.end.toISOString(), "2027-01-01T05:00:00.000Z");
});

test("formats date-only timestamps in the requested timezone", () => {
  assert.equal(
    formatDateInTimeZone(
      new Date("2026-05-12T04:00:00.000Z"),
      "America/New_York",
    ),
    "May 12, 2026",
  );
});
