import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduledOccurrences, type RecurringKind } from "./recurring";

function series(
  overrides: Partial<{
    startDate: string;
    nextRunAt: string;
    endDate: string | null;
    interval: string;
    kind: RecurringKind;
    amount: number;
    source: string | null;
    note: string | null;
    vendor: string | null;
    category: string | null;
    autoPost: boolean;
    active: boolean;
  }> = {},
) {
  return {
    id: "series-1",
    startDate: new Date(overrides.startDate ?? "2024-01-01T00:00:00.000Z"),
    interval: overrides.interval ?? "DAILY",
    nextRunAt: new Date(
      overrides.nextRunAt ?? "2024-01-01T00:00:00.000Z",
    ),
    endDate:
      overrides.endDate === undefined || overrides.endDate === null
        ? null
        : new Date(`${overrides.endDate}T00:00:00.000Z`),
    createdAt: new Date("2023-12-01T00:00:00.000Z"),
    kind: overrides.kind ?? "EXPENSE",
    amount: overrides.amount ?? 100,
    source: overrides.source ?? null,
    note: overrides.note ?? null,
    vendor: overrides.vendor ?? null,
    category: overrides.category ?? "MISC",
    autoPost: overrides.autoPost ?? true,
    active: overrides.active ?? true,
  };
}

test("clamps monthly occurrences from January 31 to February 28", () => {
  const result = scheduledOccurrences(
    series({
      startDate: "2023-01-31T00:00:00.000Z",
      nextRunAt: "2023-01-31T00:00:00.000Z",
      interval: "MONTHLY",
      kind: "INCOME",
      source: "Paycheck",
    }),
    "2023-02-01",
    "2023-02-28",
  );

  assert.deepEqual(result.map((item) => item.day), ["2023-02-28"]);
});

test("starts at nextRunAt when it falls inside the window", () => {
  const result = scheduledOccurrences(
    series({
      nextRunAt: "2024-01-03T00:00:00.000Z",
      interval: "DAILY",
    }),
    "2024-01-01",
    "2024-01-05",
  );

  assert.deepEqual(result.map((item) => item.day), [
    "2024-01-03",
    "2024-01-04",
    "2024-01-05",
  ]);
});

test("truncates occurrences at the end date", () => {
  const result = scheduledOccurrences(
    series({
      endDate: "2024-01-03",
      interval: "DAILY",
    }),
    "2024-01-01",
    "2024-01-05",
  );

  assert.deepEqual(result.map((item) => item.day), [
    "2024-01-01",
    "2024-01-02",
    "2024-01-03",
  ]);
});

test("returns no occurrences for inactive series", () => {
  assert.deepEqual(
    scheduledOccurrences(series({ active: false }), "2024-01-01", "2024-01-05"),
    [],
  );
});

test("returns three daily occurrences in a three-day window", () => {
  const result = scheduledOccurrences(
    series({ interval: "DAILY" }),
    "2024-01-02",
    "2024-01-04",
  );

  assert.deepEqual(result.map((item) => item.day), [
    "2024-01-02",
    "2024-01-03",
    "2024-01-04",
  ]);
});
